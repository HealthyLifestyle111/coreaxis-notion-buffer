import { Client } from "@notionhq/client";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DATABASE_ID =
  process.env.NOTION_DATABASE_ID || "252649c1-4370-4cbc-9f08-7c708f0d970c";
const BUFFER_API_KEY = process.env.BUFFER_API_KEY;
const BUFFER_API_URL = "https://api.buffer.com";

console.log("[INIT] Starting Notion → Buffer sync");
console.log("[ENV] NOTION_DATABASE_ID:", NOTION_DATABASE_ID);
console.log("[ENV] NOTION_TOKEN:", NOTION_TOKEN ? "set" : "MISSING");
console.log("[ENV] BUFFER_API_KEY:", BUFFER_API_KEY ? "set" : "MISSING");

if (!NOTION_TOKEN || !BUFFER_API_KEY) {
  console.error("[FATAL] Required GitHub secrets are missing.");
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });

async function bufferGraphQL(query, variables = {}) {
  const response = await fetch(BUFFER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${BUFFER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `Buffer HTTP ${response.status}: ${JSON.stringify(body)}`
    );
  }

  if (body.errors?.length) {
    throw new Error(
      `Buffer GraphQL error: ${body.errors.map((e) => e.message).join("; ")}`
    );
  }

  return body.data;
}

function checkboxIsTrue(property) {
  return property?.type === "checkbox" && property.checkbox === true;
}

function optionName(property) {
  if (property?.type === "status") return property.status?.name || "";
  if (property?.type === "select") return property.select?.name || "";
  return "";
}

function richText(property) {
  const blocks =
    property?.type === "rich_text"
      ? property.rich_text
      : property?.type === "title"
        ? property.title
        : [];
  return (blocks || []).map((block) => block.plain_text || "").join("");
}

function isReady(page) {
  const properties = page.properties || {};
  return (
    checkboxIsTrue(properties["Publish Ready"]) &&
    checkboxIsTrue(properties["Send to Buffer"]) &&
    optionName(properties["CoreAxis Automation Status"]) === "Ready"
  );
}

async function queryReadyPages() {
  console.log("[NOTION] Reading database...");
  const pages = [];
  let cursor;

  do {
    const response = await notion.databases.query({
      database_id: NOTION_DATABASE_ID,
      start_cursor: cursor,
      page_size: 100,
    });
    pages.push(...response.results);
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  const ready = pages.filter(isReady);
  console.log(`[NOTION] Found ${ready.length} ready record(s)`);
  return ready;
}

async function getInstagramChannel() {
  console.log("[BUFFER] Reading organizations using current GraphQL API...");
  const organizationData = await bufferGraphQL(`
    query GetOrganizations {
      account {
        organizations {
          id
          name
        }
      }
    }
  `);

  const organizations = organizationData?.account?.organizations || [];
  if (!organizations.length) {
    throw new Error("No Buffer organization is available to this API key.");
  }

  for (const organization of organizations) {
    const channelData = await bufferGraphQL(
      `
        query GetChannels($organizationId: OrganizationId!) {
          channels(input: { organizationId: $organizationId }) {
            id
            name
            displayName
            service
            isDisconnected
            isLocked
          }
        }
      `,
      { organizationId: organization.id }
    );

    const instagram = (channelData.channels || []).find(
      (channel) =>
        String(channel.service).toLowerCase() === "instagram" &&
        !channel.isDisconnected &&
        !channel.isLocked
    );

    if (instagram) {
      console.log(
        `[BUFFER] Using Instagram channel: ${instagram.displayName || instagram.name}`
      );
      return instagram.id;
    }
  }

  throw new Error(
    "No connected, unlocked Instagram channel was found in Buffer."
  );
}

async function createBufferPost(channelId, text) {
  const data = await bufferGraphQL(
    `
      mutation CreatePost($input: CreatePostInput!) {
        createPost(input: $input) {
          __typename
          ... on PostActionSuccess {
            post {
              id
              text
            }
          }
          ... on MutationError {
            message
          }
        }
      }
    `,
    {
      input: {
        text,
        channelId,
        schedulingType: "automatic",
        mode: "addToQueue",
      },
    }
  );

  const result = data.createPost;
  if (result?.__typename !== "PostActionSuccess" || !result.post?.id) {
    throw new Error(result?.message || "Buffer did not create the post.");
  }

  return result.post.id;
}

function statusUpdateProperty(sourceProperty) {
  if (sourceProperty?.type === "select") {
    return { select: { name: "Sent" } };
  }
  return { status: { name: "Sent" } };
}

async function markSent(page, bufferPostId) {
  const updates = {
    "CoreAxis Automation Status": statusUpdateProperty(
      page.properties?.["CoreAxis Automation Status"]
    ),
  };

  if (page.properties?.["Buffer Post ID"]) {
    updates["Buffer Post ID"] = {
      rich_text: [{ text: { content: String(bufferPostId) } }],
    };
  }

  await notion.pages.update({
    page_id: page.id,
    properties: updates,
  });
}

async function main() {
  const records = await queryReadyPages();

  if (!records.length) {
    console.log("[SYNC] Nothing is marked Ready; exiting successfully.");
    return;
  }

  const channelId = await getInstagramChannel();
  let failures = 0;

  for (const page of records) {
    try {
      const text = richText(page.properties?.["Full Copy"]);
      if (!text.trim()) {
        console.warn(`[SYNC] Skipping ${page.id}: Full Copy is empty.`);
        continue;
      }

      console.log(`[SYNC] Queueing ${page.id} in Buffer...`);
      const postId = await createBufferPost(channelId, text);
      await markSent(page, postId);
      console.log(`[SYNC] Sent ${page.id}; Buffer post ${postId}`);
    } catch (error) {
      failures += 1;
      console.error(`[SYNC] Failed ${page.id}: ${error.message}`);
    }
  }

  if (failures) {
    throw new Error(`${failures} record(s) failed.`);
  }

  console.log("[SYNC] Complete.");
}

main().catch((error) => {
  console.error("[FATAL]", error.message);
  process.exit(1);
});
