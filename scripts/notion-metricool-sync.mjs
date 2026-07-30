import { Client } from "@notionhq/client";
import { resolvePublisher } from "./publishing-routing.mjs";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID || "2fc38cda2cba491cb090d4f09d0ec1d2";
const METRICOOL_USER_TOKEN = process.env.METRICOOL_USER_TOKEN;
const METRICOOL_USER_ID = process.env.METRICOOL_USER_ID;
const METRICOOL_BLOG_ID = process.env.METRICOOL_BLOG_ID;
const API = "https://app.metricool.com/api";

if (!NOTION_TOKEN || !METRICOOL_USER_TOKEN || !METRICOOL_USER_ID || !METRICOOL_BLOG_ID) {
  console.error("[FATAL] NOTION_TOKEN and Metricool user token/user ID/blog ID must be set.");
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });

function checked(property) { return property?.type === "checkbox" && property.checkbox === true; }
function optionName(property) {
  if (property?.type === "status") return property.status?.name || "";
  if (property?.type === "select") return property.select?.name || "";
  return "";
}
function textValue(property) {
  const blocks = property?.type === "rich_text" ? property.rich_text : property?.type === "title" ? property.title : [];
  return (blocks || []).map((block) => block.plain_text || "").join("");
}
function dateValue(property) { return property?.type === "date" ? property.date?.start || "" : ""; }
function selectedPlatforms(property) { return property?.type === "multi_select" ? property.multi_select.map((item) => item.name) : []; }

function ready(page) {
  const p = page.properties || {};
  const platforms = selectedPlatforms(p.Platform).filter((platform) => platform !== "Email");
  const routing = resolvePublisher({
    platforms,
    sendToBuffer: checked(p["Send to Buffer"]),
    distributionRoute: optionName(p["Distribution Route"]) || textValue(p["Distribution Route"]),
  });
  return checked(p["Jenna Approved"]) && checked(p["Publish Ready"]) &&
    optionName(p.Status) === "Approved" && optionName(p["Compliance Check"]) === "Cleared" &&
    optionName(p["CoreAxis Automation Status"]) === "Ready" && routing.publisher === "metricool";
}

async function metricool(path, { method = "GET", body } = {}) {
  const url = new URL(`${API}${path}`);
  url.searchParams.set("userId", METRICOOL_USER_ID);
  url.searchParams.set("blogId", METRICOOL_BLOG_ID);
  const response = await fetch(url, {
    method,
    headers: { "X-Mc-Auth": METRICOOL_USER_TOKEN, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Metricool HTTP ${response.status}: ${JSON.stringify(payload)}`);
  return payload?.data ?? payload;
}

async function validateBrand() {
  const profiles = await metricool("/admin/simpleProfiles");
  const list = Array.isArray(profiles) ? profiles : profiles?.data || [];
  const match = list.find((profile) => String(profile.id ?? profile.blogId) === String(METRICOOL_BLOG_ID));
  if (!match) throw new Error(`Metricool blogId ${METRICOOL_BLOG_ID} is not accessible to userId ${METRICOOL_USER_ID}.`);
  console.log(`[METRICOOL] Active brand validated: ${match.name || match.label || METRICOOL_BLOG_ID}`);
}

async function getReadyPages() {
  const pages = [];
  let start_cursor;
  do {
    const response = await notion.databases.query({ database_id: NOTION_DATABASE_ID, page_size: 100, start_cursor });
    pages.push(...response.results);
    start_cursor = response.has_more ? response.next_cursor : undefined;
  } while (start_cursor);
  return pages.filter(ready);
}

function providerName(platform) {
  return ({ Instagram: "instagram", TikTok: "tiktok", YouTube: "youtube", "YouTube Shorts": "youtube" })[platform];
}

function formatInTimezone(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}:${value("second")}`;
}

function publicationDate(properties) {
  const raw = dateValue(properties["Scheduled Time"]) || dateValue(properties.Date);
  const date = new Date(raw);
  if (!raw || Number.isNaN(date.getTime())) throw new Error("No valid Scheduled Time is set.");
  if (date.getTime() <= Date.now() + 60_000) throw new Error("Scheduled Time must be safely in the future.");
  const timezone = optionName(properties.Timezone) || "America/New_York";
  return {
    dateTime: formatInTimezone(date, timezone),
    timezone,
  };
}

async function normalizeMedia(url) {
  if (!url) return [];
  const normalized = await metricool(`/actions/normalize/image/url?url=${encodeURIComponent(url)}`);
  if (typeof normalized === "string") return [normalized];
  if (normalized?.url) return [normalized.url];
  if (normalized?.mediaId) return [String(normalized.mediaId)];
  return [url];
}

async function createPost(page) {
  const p = page.properties || {};
  const platforms = selectedPlatforms(p.Platform).filter((platform) => ["Instagram", "TikTok", "YouTube", "YouTube Shorts"].includes(platform));
  const existing = textValue(p["Scheduler ID"]);
  if (existing) {
    console.log(`[SKIP] ${textValue(p["Content Title"])} already has Scheduler ID ${existing}`);
    return;
  }
  const text = textValue(p["Full Copy"]);
  if (!text.trim()) throw new Error("Full Copy is empty.");
  const mediaUrl = p["Buffer Media URL"]?.url || "";
  const media = await normalizeMedia(mediaUrl);
  const providers = platforms.map((platform) => ({ network: providerName(platform), status: "PENDING" }));
  const body = {
    publicationDate: publicationDate(p),
    text,
    providers,
    media,
    autoPublish: true,
    saveExternalMediaFiles: true,
    draft: false,
  };
  if (platforms.includes("YouTube") || platforms.includes("YouTube Shorts")) {
    body.youtubeData = {
      title: textValue(p["Content Title"]).slice(0, 100),
      type: "SHORT",
      privacy: "PUBLIC",
      tags: textValue(p["Platform Hashtags"]).replace(/#/g, "").split(/\s+/).filter(Boolean).slice(0, 15),
    };
  }
  if (platforms.includes("TikTok")) {
    body.tiktokData = { disableComment: false, disableDuet: false, disableStitch: false, privacyOption: "PUBLIC_TO_EVERYONE" };
  }
  const created = await metricool("/v2/scheduler/posts", { method: "POST", body });
  const id = created?.id || created?.uuid;
  if (!id) throw new Error(`Metricool did not return a scheduled post ID: ${JSON.stringify(created)}`);
  await notion.pages.update({
    page_id: page.id,
    properties: {
      "Scheduler ID": { rich_text: [{ text: { content: `Metricool:${id}` } }] },
      "External Post ID": { rich_text: [{ text: { content: String(created?.uuid || id) } }] },
      "CoreAxis Automation Status": { select: { name: "Synced" } },
      "Publishing Status": { select: { name: "Queued" } },
      "Publishing Error": { rich_text: [] },
    },
  });
  console.log(`[SYNC] Queued ${textValue(p["Content Title"])} to ${platforms.join(", ")} as ${id}`);
}

async function main() {
  console.log("[INIT] Starting approved Notion → Metricool sync");
  await validateBrand();
  const pages = await getReadyPages();
  console.log(`[NOTION] ${pages.length} Metricool-ready record(s)`);
  let failures = 0;
  for (const page of pages) {
    try { await createPost(page); }
    catch (error) {
      failures += 1;
      console.error(`[ERROR] ${error.message}`);
      await notion.pages.update({ page_id: page.id, properties: {
        "CoreAxis Automation Status": { select: { name: "Error" } },
        "Publishing Status": { select: { name: "Failed" } },
        "Publishing Error": { rich_text: [{ text: { content: String(error.message).slice(0, 1900) } }] },
      } });
    }
  }
  if (failures) throw new Error(`${failures} Metricool record(s) failed; see Publishing Error in Notion.`);
  console.log("[SYNC] Metricool complete.");
}

main().catch((error) => { console.error("[FATAL]", error.message); process.exit(1); });