const NOTION_VERSION = "2026-03-11";
const BUFFER_ENDPOINT = "https://api.buffer.com";
const DATA_SOURCE_ID = "252649c1-4370-4cbc-9f08-7c708f0d970c";

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runSync(env));
  },

  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({
        ok: true,
        service: "CoreAxis Notion to Buffer"
      });
    }

    if (url.pathname === "/channels") {
      if (!authorized(request, env)) {
        return new Response("Unauthorized", { status: 401 });
      }

      try {
        return json(
          await bufferGraphQL(
            env,
            `
              query {
                account {
                  organizations {
                    id
                    name
                  }
                }
              }
            `
          )
        );
      } catch (error) {
        return json(
          {
            ok: false,
            error: error.message
          },
          500
        );
      }
    }

    if (url.pathname === "/run" && request.method === "POST") {
      if (!authorized(request, env)) {
        return new Response("Unauthorized", { status: 401 });
      }

      try {
        return json(await runSync(env));
      } catch (error) {
        return json(
          {
            ok: false,
            error: error.message
          },
          500
        );
      }
    }

    return new Response("CoreAxis Notion to Buffer automation", {
      status: 200
    });
  }
};

function authorized(request, env) {
  const supplied = request.headers.get("x-coreaxis-key");
  return Boolean(env.ADMIN_KEY && supplied === env.ADMIN_KEY);
}

async function runSync(env) {
  requireEnv(env, ["NOTION_TOKEN", "BUFFER_API_KEY"]);

  const pages = await queryReadyPages(env);
  const results = [];

  for (const page of pages) {
    try {
      const postIds = await schedulePage(page, env);

      await updateNotionPage(page.id, env, {
        "Buffer Post IDs": richText(postIds.join(", ")),
        "Scheduler ID": richText(postIds.join(", ")),
        "Buffer Error": richText(""),
        "Publishing Error": richText(""),
        "CoreAxis Automation Status": select("Synced"),
        "Publishing Status": select("Queued"),
        "Status": select("Scheduled"),
        "Send to Buffer": {
          checkbox: false
        }
      });

      results.push({
        pageId: page.id,
        ok: true,
        postIds
      });
    } catch (error) {
      await updateNotionPage(page.id, env, {
        "Buffer Error": richText(error.message.slice(0, 1900)),
        "Publishing Error": richText(error.message.slice(0, 1900)),
        "CoreAxis Automation Status": select("Error"),
        "Publishing Status": select("Failed")
      });

      results.push({
        pageId: page.id,
        ok: false,
        error: error.message
      });
    }
  }

  return {
    ok: true,
    processed: results.length,
    results
  };
}

async function queryReadyPages(env) {
  const response = await fetch(
    `https://api.notion.com/v1/data_sources/${DATA_SOURCE_ID}/query`,
    {
      method: "POST",
      headers: notionHeaders(env),
      body: JSON.stringify({
        page_size: 100,
        filter: {
          and: [
            {
              property: "Send to Buffer",
              checkbox: {
                equals: true
              }
            },
            {
              property: "Jenna Approved",
              checkbox: {
                equals: true
              }
            },
            {
              property: "Publish Ready",
              checkbox: {
                equals: true
              }
            },
            {
              property: "Status",
              select: {
                equals: "Approved"
              }
            }
          ]
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(
      `Notion query failed: ${response.status} ${await response.text()}`
    );
  }

  const data = await response.json();

  return data.results.filter(
    page => !text(page.properties["Buffer Post IDs"])
  );
}

async function schedulePage(page, env) {
  const properties = page.properties;

  const copy =
    text(properties["Meta Safe Copy"]) ||
    text(properties["Full Copy"]);

  if (!copy) {
    throw new Error(
      "No post copy found in Meta Safe Copy or Full Copy."
    );
  }

  const keywordText = text(properties["Search Keywords"]);
  const hashtags = keywordText.includes("#") ? keywordText : "";

  const postText = [copy.trim(), hashtags.trim()]
    .filter(Boolean)
    .join("\n\n");

  const dueAt =
    dateStart(properties["Buffer Publish At"]) ||
    dateStart(properties["Scheduled Time"]) ||
    dateStart(properties["Date"]);

  if (!dueAt) {
    throw new Error(
      "No Buffer Publish At, Scheduled Time, or Date value found."
    );
  }

  const channelIds = text(properties["Buffer Channel IDs"])
    .split(/[\n,]/)
    .map(value => value.trim())
    .filter(Boolean);

  if (!channelIds.length) {
    throw new Error(
      "Buffer Channel IDs is empty. Add one or more comma-separated Buffer channel IDs."
    );
  }

  const mediaUrl = urlValue(properties["Buffer Media URL"]);
  const format = selectValue(properties["Format"]);

  const assetType = mediaUrl
    ? inferAssetType(mediaUrl, format)
    : null;

  const postIds = [];

  for (const channelId of channelIds) {
    const id = await createBufferPost({
      env,
      channelId,
      text: postText,
      dueAt: new Date(dueAt).toISOString(),
      mediaUrl,
      assetType
    });

    postIds.push(id);
  }

  return postIds;
}

async function createBufferPost({
  env,
  channelId,
  text,
  dueAt,
  mediaUrl,
  assetType
}) {
  const assets = mediaUrl
    ? assetType === "video"
      ? [
          {
            video: {
              url: mediaUrl,
              metadata: {
                thumbnailOffset: 1000
              }
            }
          }
        ]
      : [
          {
            image: {
              url: mediaUrl
            }
          }
        ]
    : undefined;

  const query = `
    mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess {
          post {
            id
            text
            dueAt
          }
        }

        ... on MutationError {
          message
        }
      }
    }
  `;

  const input = {
    text,
    channelId,
    schedulingType: "automatic",
    mode: "customScheduled",
    dueAt,
    ...(assets ? { assets } : {})
  };

  const data = await bufferGraphQL(env, query, {
    input
  });

  const result = data?.data?.createPost;

  if (!result) {
    throw new Error(
      `Buffer returned no createPost result: ${JSON.stringify(data)}`
    );
  }

  if (result.message) {
    throw new Error(`Buffer error: ${result.message}`);
  }

  if (!result.post?.id) {
    throw new Error(
      `Buffer post ID missing: ${JSON.stringify(result)}`
    );
  }

  return result.post.id;
}

async function bufferGraphQL(env, query, variables = {}) {
  const response = await fetch(BUFFER_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.BUFFER_API_KEY}`
    },
    body: JSON.stringify({
      query,
      variables
    })
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(
      `Buffer HTTP ${response.status}: ${body}`
    );
  }

  const data = JSON.parse(body);

  if (data.errors?.length) {
    throw new Error(
      `Buffer GraphQL: ${data.errors
        .map(error => error.message)
        .join("; ")}`
    );
  }

  return data;
}

async function updateNotionPage(pageId, env, properties) {
  const response = await fetch(
    `https://api.notion.com/v1/pages/${pageId}`,
    {
      method: "PATCH",
      headers: notionHeaders(env),
      body: JSON.stringify({
        properties
      })
    }
  );

  if (!response.ok) {
    throw new Error(
      `Notion update failed: ${response.status} ${await response.text()}`
    );
  }
}

function notionHeaders(env) {
  return {
    Authorization: `Bearer ${env.NOTION_TOKEN}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json"
  };
}

function requireEnv(env, keys) {
  const missing = keys.filter(key => !env[key]);

  if (missing.length) {
    throw new Error(
      `Missing secrets: ${missing.join(", ")}`
    );
  }
}

function text(property) {
  if (!property) {
    return "";
  }

  const values =
    property.rich_text ||
    property.title ||
    [];

  return values
    .map(value => value.plain_text || value.text?.content || "")
    .join("");
}

function dateStart(property) {
  return property?.date?.start || "";
}

function selectValue(property) {
  return property?.select?.name || "";
}

function urlValue(property) {
  return property?.url || "";
}

function inferAssetType(url, format) {
  if (/\.((mp4)|(mov)|(m4v)|(webm))($|\?)/i.test(url)) {
    return "video";
  }

  if (/reel|story|video/i.test(format || "")) {
    return "video";
  }

  return "image";
}

function richText(value) {
  return {
    rich_text: value
      ? [
          {
            type: "text",
            text: {
              content: value
            }
          }
        ]
      : []
  };
}

function select(name) {
  return {
    select: {
      name
    }
  };
}

function json(value, status = 200) {
  return new Response(
    JSON.stringify(value, null, 2),
    {
      status,
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
}
