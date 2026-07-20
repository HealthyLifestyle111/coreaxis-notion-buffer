import { Client } from "@notionhq/client";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID || "2fc38cda2cba491cb090d4f09d0ec1d2";
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
    headers: { Authorization: `Bearer ${BUFFER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Buffer HTTP ${response.status}: ${JSON.stringify(body)}`);
  if (body.errors?.length) throw new Error(body.errors.map((error) => error.message).join("; "));
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
  const blocks = property?.type === "rich_text" ? property.rich_text : property?.type === "title" ? property.title : [];
  return (blocks || []).map((block) => block.plain_text || "").join("");
}

function dateValue(property) {
  return property?.type === "date" ? property.date?.start || "" : "";
}

function selectedPlatforms(property) {
  return property?.type === "multi_select" ? property.multi_select.map((item) => item.name) : [];
}

function isApprovedAndReady(page) {
  const p = page.properties || {};
  return checked(p["Jenna Approved"]) && checked(p["Publish Ready"]) && checked(p["Send to Buffer"]) &&
    optionName(p["Status"]) === "Approved" && optionName(p["Compliance Check"]) === "Cleared" &&
    optionName(p["CoreAxis Automation Status"]) === "Ready";
}

async function getReadyPages() {
  const pages = [];
  let start_cursor;
  do {
    const response = await notion.databases.query({ database_id: NOTION_DATABASE_ID, page_size: 100, start_cursor });
    pages.push(...response.results);
    start_cursor = response.has_more ? response.next_cursor : undefined;
  } while (start_cursor);
  const ready = pages.filter(isApprovedAndReady);
  console.log(`[NOTION] ${ready.length} approved, compliant and ready record(s)`);
  return ready;
}

async function getBufferChannels() {
  const organizationData = await bufferGraphQL(`query GetOrganizations { account { organizations { id name } } }`);
  const organizations = organizationData?.account?.organizations || [];
  if (!organizations.length) throw new Error("The Buffer API key has no accessible organization.");
  const channels = [];
  for (const organization of organizations) {
    const channelData = await bufferGraphQL(`
      query GetChannels($organizationId: OrganizationId!) {
        channels(input: { organizationId: $organizationId }) {
          id name displayName service isDisconnected isLocked
        }
      }
    `, { organizationId: organization.id });
    channels.push(...(channelData.channels || []).filter((channel) => !channel.isDisconnected && !channel.isLocked));
  }
  console.log(`[BUFFER] ${channels.length} connected channel(s): ${channels.map((c) => c.service).join(", ")}`);
  return channels;
}

// This workflow is Buffer-only. Any platform not listed here MUST fail closed.
// It must never be marked Synced, Ready, or successfully routed by this job.
const BUFFER_PLATFORMS = new Set(["X", "LinkedIn", "Pinterest"]);

const SERVICE_NAMES = {
  X: ["twitter", "x"],
  LinkedIn: ["linkedin"],
  Pinterest: ["pinterest"],
};

function channelForPlatform(channels, platform) {
  const accepted = SERVICE_NAMES[platform] || [];
  return channels.find((channel) => accepted.includes(String(channel.service).toLowerCase()));
}

async function mediaAssets(properties) {
  const url = properties["Buffer Media URL"]?.url || "";
  if (!url) return [];
  if (/\.json(?:\?|$)/i.test(url)) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Media manifest HTTP ${response.status}.`);
    const manifest = await response.json();
    if (!Array.isArray(manifest.assets) || !manifest.assets.length) throw new Error("Media manifest has no assets.");
    return manifest.assets.map((asset) => asset.type === "video"
      ? { video: { url: asset.url, metadata: { thumbnailOffset: asset.thumbnailOffset || 1500 } } }
      : { image: { url: asset.url } });
  }
  const format = optionName(properties["Format"]).toLowerCase();
  const isVideo = format === "reel" || /\.(mp4|mov|m4v|webm)(?:\?|$)/i.test(url);
  return isVideo
    ? [{ video: { url, metadata: { thumbnailOffset: 1500 } } }]
    : [{ image: { url } }];
}

function scheduledAt(properties) {
  return dateValue(properties["Buffer Publish At"]) || dateValue(properties["Scheduled Time"]) || dateValue(properties["Date"]);
}

function splitThread(text) {
  return text.split(/\n\s*\n(?=\d+\/\s)/).map((part) => part.trim()).filter(Boolean);
}

function metadataFor(platform, format, text, title) {
  const f = String(format).toLowerCase();
  if (platform === "X" && f === "thread") {
    const thread = splitThread(text);
    if (thread.length < 2) throw new Error("X thread copy is not split into numbered posts.");
    return { twitter: { thread: thread.map((part) => ({ text: part })) } };
  }
  return undefined;
}

async function createBufferPost({ channelId, platform, format, text, title, dueAt, assets }) {
  const due = new Date(dueAt);
  if (!dueAt || Number.isNaN(due.getTime())) throw new Error("No valid Buffer Publish At or Scheduled Time is set.");
  if (due.getTime() <= Date.now() + 60_000) throw new Error("Publish time is not safely in the future; reschedule in Notion.");
  const input = {
    text: platform === "X" && String(format).toLowerCase() === "thread" ? splitThread(text)[0] : text,
    channelId,
    schedulingType: "automatic",
    mode: "customScheduled",
    dueAt: due.toISOString(),
  };
  if (assets.length) input.assets = assets;
  const metadata = metadataFor(platform, format, text, title);
  if (metadata) input.metadata = metadata;
  const data = await bufferGraphQL(`
    mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        __typename
        ... on PostActionSuccess { post { id text dueAt status } }
        ... on MutationError { message }
      }
    }
  `, { input });
  const result = data.createPost;
  if (result?.__typename !== "PostActionSuccess" || !result.post?.id) throw new Error(result?.message || "Buffer did not create the post.");
  return result.post.id;
}

async function updatePage(pageId, properties) {
  await notion.pages.update({ page_id: pageId, properties });
}

async function markSynced(pageId, postIds, channelIds) {
  await updatePage(pageId, {
    "Buffer Channel IDs": { rich_text: [{ text: { content: channelIds.join(", ") } }] },
    "Buffer Post IDs": { rich_text: [{ text: { content: postIds.join(", ") } }] },
    "Scheduler ID": { rich_text: [{ text: { content: postIds.join(", ") } }] },
    "CoreAxis Automation Status": { select: { name: "Synced" } },
    "Publishing Status": { select: { name: "Queued" } },
    "Buffer Error": { rich_text: [] },
  });
}

async function markError(pageId, message, postIds = []) {
  const properties = {
    "CoreAxis Automation Status": { select: { name: "Error" } },
    "Publishing Status": { select: { name: "Failed" } },
    "Buffer Error": { rich_text: [{ text: { content: String(message).slice(0, 1900) } }] },
  };
  if (postIds.length) properties["Buffer Post IDs"] = { rich_text: [{ text: { content: postIds.join(", ") } }] };
  await updatePage(pageId, properties);
}

async function main() {
  console.log("[INIT] Starting approved Notion → Buffer sync");
  const records = await getReadyPages();
  if (!records.length) return console.log("[SYNC] Nothing is ready.");
  const channels = await getBufferChannels();
  let failedRecords = 0;
  for (const page of records) {
    const p = page.properties || {};
    const title = textValue(p["Content Title"]) || page.id;
    const text = textValue(p["Full Copy"]);
    const format = optionName(p["Format"]);
    const platforms = selectedPlatforms(p["Platform"]).filter((platform) => platform !== "Email");
    const unsupportedPlatforms = platforms.filter((platform) => !BUFFER_PLATFORMS.has(platform));
    const dueAt = scheduledAt(p);
    const postIds = [];
    const channelIds = [];
    try {
      if (!text.trim()) throw new Error("Full Copy is empty.");
      if (!platforms.length) throw new Error("No platform is selected.");
      if (format === "Engagement Block") throw new Error("Engagement blocks are native actions, not scheduled posts.");
      if (unsupportedPlatforms.length) {
        throw new Error(`No active publisher exists in this workflow for ${unsupportedPlatforms.join(", ")}. This job is Buffer-only; do not mark this record Synced until a real scheduler ID is returned by the correct platform publisher.`);
      }
      const missingPlatforms = platforms.filter((platform) => !channelForPlatform(channels, platform));
      if (missingPlatforms.length) {
        throw new Error(`Approved Buffer route is not active for ${missingPlatforms.join(", ")}.`);
      }
      const assets = await mediaAssets(p);
      for (const platform of platforms) {
        const channel = channelForPlatform(channels, platform);
        if (platform === "Pinterest" && !assets.length) {
          throw new Error(`${platform} requires a public Buffer Media URL.`);
        }
        const postId = await createBufferPost({ channelId: channel.id, platform, format, text, title, dueAt, assets });
        postIds.push(`${platform}:${postId}`);
        channelIds.push(`${platform}:${channel.id}`);
      }
      await markSynced(page.id, postIds, channelIds);
      console.log(`[SYNC] Queued "${title}" for ${platforms.join(", ")}`);
    } catch (error) {
      failedRecords += 1;
      console.error(`[SYNC] "${title}" failed: ${error.message}`);
      await markError(page.id, error.message, postIds);
    }
  }
  if (failedRecords) throw new Error(`${failedRecords} record(s) need correction; see Buffer Error in Notion.`);
  console.log("[SYNC] Complete.");
}

main().catch((error) => { console.error("[FATAL]", error.message); process.exit(1); });
