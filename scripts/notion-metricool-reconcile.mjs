import { Client } from "@notionhq/client";
import { notionReconciliationProperties, providerOutcome, stripMetricoolPrefix } from "./metricool-reconciliation.mjs";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID || "2fc38cda2cba491cb090d4f09d0ec1d2";
const METRICOOL_USER_TOKEN = process.env.METRICOOL_USER_TOKEN;
const METRICOOL_USER_ID = process.env.METRICOOL_USER_ID;
const METRICOOL_BLOG_ID = process.env.METRICOOL_BLOG_ID;
const API = "https://app.metricool.com/api";

if (!NOTION_TOKEN || !METRICOOL_USER_TOKEN || !METRICOOL_USER_ID || !METRICOOL_BLOG_ID) {
  throw new Error("NOTION_TOKEN and Metricool user token/user ID/blog ID must be set.");
}

const notion = new Client({ auth: NOTION_TOKEN });

function textValue(property) {
  const blocks = property?.type === "rich_text" ? property.rich_text : property?.type === "title" ? property.title : [];
  return (blocks || []).map((block) => block.plain_text || "").join("");
}

function optionName(property) {
  if (property?.type === "status") return property.status?.name || "";
  if (property?.type === "select") return property.select?.name || "";
  return "";
}

async function metricool(path) {
  const url = new URL(`${API}${path}`);
  url.searchParams.set("userId", METRICOOL_USER_ID);
  url.searchParams.set("blogId", METRICOOL_BLOG_ID);
  const response = await fetch(url, { headers: { "X-Mc-Auth": METRICOOL_USER_TOKEN, Accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Metricool HTTP ${response.status}: ${JSON.stringify(payload)}`);
  return payload?.data ?? payload;
}

async function queuedPages() {
  const pages = [];
  let start_cursor;
  do {
    const response = await notion.databases.query({ database_id: NOTION_DATABASE_ID, page_size: 100, start_cursor });
    pages.push(...response.results);
    start_cursor = response.has_more ? response.next_cursor : undefined;
  } while (start_cursor);
  return pages.filter((page) => {
    const p = page.properties || {};
    const schedulerId = textValue(p["Scheduler ID"]);
    const externalId = textValue(p["External Post ID"]);
    const status = optionName(p["Publishing Status"]);
    return /^Metricool:/i.test(schedulerId) && !externalId && ["Queued", "Scheduled", "Synced", "Ready"].includes(status);
  });
}

async function fetchScheduledPost(id) {
  const candidates = [`/v2/scheduler/posts/${encodeURIComponent(id)}`, `/v2/scheduler/posts?id=${encodeURIComponent(id)}`];
  let lastError;
  for (const path of candidates) {
    try {
      const payload = await metricool(path);
      if (Array.isArray(payload)) return payload.find((item) => String(item?.id || item?.uuid) === String(id)) || payload[0] || {};
      if (Array.isArray(payload?.posts)) return payload.posts.find((item) => String(item?.id || item?.uuid) === String(id)) || payload.posts[0] || {};
      return payload;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error(`Unable to fetch Metricool post ${id}`);
}

async function reconcile(page) {
  const id = stripMetricoolPrefix(textValue(page.properties?.["Scheduler ID"]));
  if (!id) return;
  try {
    const post = await fetchScheduledPost(id);
    const outcome = providerOutcome(post);
    const properties = notionReconciliationProperties(outcome);
    if (Object.keys(properties).length) {
      await notion.pages.update({ page_id: page.id, properties });
      console.log(`[RECONCILE] ${id} -> ${outcome.state}`);
    } else {
      console.log(`[RECONCILE] ${id} still pending`);
    }
  } catch (error) {
    await notion.pages.update({ page_id: page.id, properties: {
      "Publishing Error": { rich_text: [{ text: { content: `Reconciliation error: ${String(error.message).slice(0, 1850)}` } }] },
    } });
    throw error;
  }
}

const pages = await queuedPages();
console.log(`[RECONCILE] ${pages.length} queued Metricool record(s)`);
let failures = 0;
for (const page of pages) {
  try { await reconcile(page); }
  catch (error) { failures += 1; console.error(`[ERROR] ${error.message}`); }
}
if (failures) throw new Error(`${failures} Metricool reconciliation record(s) failed.`);
