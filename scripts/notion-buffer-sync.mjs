import { Client } from "@notionhq/client";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DATABASE_ID =
  process.env.NOTION_DATABASE_ID || "252649c1-4370-4cbc-9f08-7c708f0d970c";
const BUFFER_API_KEY = process.env.BUFFER_API_KEY;
const BUFFER_API_URL = "https://api.buffer.com";

if (!NOTION_TOKEN || !BUFFER_API_KEY) {
  console.error("[FATAL] NOTION_TOKEN and BUFFER_API_KEY must both be set.");
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
    throw new Error(`Buffer HTTP ${response.status}: ${JSON.stringify(body)}`);
  }
  if (body.errors?.length) {
    throw new Error(body.errors.map((error) => error.message).join("; "));
  }
  return body.data;
}

function checked(property) {
  return property?.type === "checkbox" && property.checkbox === true;
}

function optionName(property) {
  if (property?.type === "status") return property.status?.name || "";
  if (property?.type === "select") return property.select?.name || "";
  return "";
}

function textValue(property) {
  const blocks =
    property?.type === "rich_text"
      ? property.rich_text
      : property?.type === "title"
        ? property.title
        : [];
  return (blocks || []).map((block) => block.plain_text || "").join("");
}

function dateValue(property) {
  return property?.type === "date" ? property.date?.start || "" : "";
}

function selectedPlatforms(property) {
  if (property?.type !== "multi_select") return [];
  return property.multi_select.map((item) => item.name);
}

function isApprovedAndReady(page) {
  const properties = page.properties || {};
  return (
    checked(properties["Jenna Approved"]) &&
    checked(properties["Publish Ready"]) &&
    checked(properties["Send to Buffer"]) &&
    optionName(properties["Compliance Check"]) === "Cleared" &&
    optionName(properties["CoreAxis Automation Status"]) === "Ready"
  );
}

async function getReadyPages() {
  const pages = [];
  let start_cursor;
  do {
    const response = await notion.databases.query({
      database_id: NOTION_DATABASE_ID,
      page_size: 100,
      start_cursor,
    });
    pages.push(...response.results);
    start_cursor = response.has_more ? response.next_cursor : undefined;
  } while (start_cursor);

  const ready = pages.filter(isApprovedAndReady);
  console.log(`[NOTION] ${ready.length} approved, compliance-cleared, and ready record(s)`);
  return ready;
}

async function getBufferChannels() {
  const organizationData = await bufferGraphQL(`
    query GetOrganizations {
      account {
        organizations { id name }
      }
    }
  `);
  const organizations = organizationData?.account?.organizations || [];
  if (!organizations.length) {
    throw new Error("The Buffer API key has no accessible organization.");
  }

  const channels = [];
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
    channels.push(
      ...(channelData.channels || []).filter(
        (channel) => !channel.isDisconnected && !channel.isLocked
      )
    );
  }
  console.log(`[BUFFER] ${channels.length} connected channel(s) available`);
  return channels;
}

const SERVICE_NAMES = {
  Instagram: ["instagram"],
  LinkedIn: ["linkedin"],
  Facebook: ["facebook"],
  X: ["twitter", "x"],
  TikTok: ["tiktok"],
  "YouTube Shorts": ["youtube"],
  Pinterest: ["pinterest"],
};

function channelForPlatform(channels, platform) {
  const accepted = SERVICE_NAMES[platform] || [];
  return channels.find((channel) =>
    accepted.includes(String(channel.service).toLowerCase())
  );
}

function mediaAsset(properties) {
  const url = properties["Buffer Media URL"]?.url || "";
  if (!url) return undefined;

  const format = optionName(properties["Format"]).toLowerCase();
  const isVideo =
    format === "reel" ||
    /\.(mp4|mov|m4v|webm)(\?|$)/i.test(url);

  return isVideo ? [{ video: { url } }] : [{ image: { url } }];
}

function scheduledAt(properties) {
  return (
    dateValue(properties["Buffer Publish At"]) ||
    dateValue(properties["Scheduled Time"]) ||
    dateValue(properties["Date"])
  );
}

async function createBufferPost({ channelId, text, dueAt, assets }) {
  const due = new Date(dueAt);
  if (!dueAt || Number.isNaN(due.getTime())) {
    throw new Error("No valid Buffer Publish At or Scheduled Time is set.");
  }

  const isFuture = due.getTime() > Date.now() + 60_000;
  const input = {
    text,
    channelId,
    schedulingType: "automatic",
    mode: isFuture ? "customScheduled" : "shareNow",
  };
  if (isFuture) input.dueAt = due.toISOString();
  if (assets) input.assets = assets;

  const data = await bufferGraphQL(
    `
      mutation CreatePost($input: CreatePostInput!) {
        createPost(input: $input) {
          __typename
          ... on PostActionSuccess { post { id text } }
          ... on MutationError { message }
        }
      }
    `,
    { input }
  );

  const result = data.createPost;
  if (result?.__typename !== "PostActionSuccess" || !result.post?.id) {
    throw new Error(result?.message || "Buffer did not create the post.");
  }
  return result.post.id;
}

async function updatePage(pageId, properties) {
  await notion.pages.update({ page_id: pageId, properties });
}

async function markSynced(pageId, postIds) {
  await updatePage(pageId, {
    "Buffer Post IDs": {
      rich_text: [{ text: { content: postIds.join(", ") } }],
    },
    "CoreAxis Automation Status": { select: { name: "Synced" } },
    "Publishing Status": { select: { name: "Queued" } },
    "Buffer Error": { rich_text: [] },
  });
}

async function markError(pageId, message, postIds = []) {
  const properties = {
    "CoreAxis Automation Status": { select: { name: "Error" } },
    "Publishing Status": { select: { name: "Failed" } },
    "Buffer Error": {
      rich_text: [{ text: { content: String(message).slice(0, 1900) } }],
    },
  };
  if (postIds.length) {
    properties["Buffer Post IDs"] = {
      rich_text: [{ text: { content: postIds.join(", ") } }],
    };
  }
  await updatePage(pageId, properties);
}

async function main() {
  console.log("[INIT] Starting approved Notion → Buffer sync");
  const records = await getReadyPages();
  if (!records.length) {
    console.log("[SYNC] Nothing is approved and ready.");
    return;
  }

  const channels = await getBufferChannels();
  let failedRecords = 0;

  for (const page of records) {
    const properties = page.properties || {};
    const title = textValue(properties["Content Title"]) || page.id;
    const text = textValue(properties["Full Copy"]);
    const platforms = selectedPlatforms(properties["Platform"]).filter(
      (platform) => platform !== "Email"
    );
    const dueAt = scheduledAt(properties);
    const assets = mediaAsset(properties);
    const postIds = [];

    try {
      if (!text.trim()) throw new Error("Full Copy is empty.");
      if (!platforms.length) throw new Error("No Buffer-supported Platform is selected.");
      if (!dueAt) throw new Error("No publish date/time is set.");

      for (const platform of platforms) {
        const channel = channelForPlatform(channels, platform);
        if (!channel) {
          throw new Error(`No connected Buffer channel found for ${platform}.`);
        }
        if (
          ["Instagram", "TikTok", "YouTube Shorts", "Pinterest"].includes(platform) &&
          !assets
        ) {
          throw new Error(`${platform} requires a public Buffer Media URL.`);
        }

        const postId = await createBufferPost({
          channelId: channel.id,
          text,
          dueAt,
          assets,
        });
        postIds.push(`${platform}:${postId}`);
      }

      await markSynced(page.id, postIds);
      console.log(`[SYNC] Queued "${title}" for ${platforms.join(", ")}`);
    } catch (error) {
      failedRecords += 1;
      console.error(`[SYNC] "${title}" failed: ${error.message}`);
      await markError(page.id, error.message, postIds);
    }
  }

  if (failedRecords) {
    throw new Error(`${failedRecords} record(s) need correction; see Buffer Error in Notion.`);
  }
  console.log("[SYNC] Complete.");
}

main().catch((error) => {
  console.error("[FATAL]", error.message);
  process.exit(1);
});
