import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DATABASE_ID = process.env.NOTION_DATABASE_ID || "2fc38cda2cba491cb090d4f09d0ec1d2";
const META_VERSION = process.env.META_GRAPH_VERSION || "v23.0";
const LINKEDIN_VERSION = process.env.LINKEDIN_VERSION || "202606";
const DUE_EARLY_MS = 4 * 60 * 1000;
const DUE_LATE_MS = 24 * 60 * 60 * 1000;

if (!process.env.NOTION_TOKEN) throw new Error("NOTION_TOKEN is required");

function checked(p) { return p?.type === "checkbox" && p.checkbox === true; }
function option(p) { return p?.select?.name || p?.status?.name || ""; }
function text(p) { return (p?.rich_text || p?.title || []).map((x) => x.plain_text || "").join(""); }
function platforms(p) { return (p?.multi_select || []).map((x) => x.name); }
function date(p) { return p?.date?.start || ""; }
function cleanCopy(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\[([^\]]+)]\((https?:\/\/[^)]+)\)/g, "$1: $2")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function dueAt(p) {
  return date(p["Scheduled Time"]) || date(p["Buffer Publish At"]) || date(p.Date);
}

function eligible(page) {
  const p = page.properties || {};
  const native = platforms(p.Platform).filter((x) => ["Instagram", "Facebook", "LinkedIn", "YouTube Shorts"].includes(x));
  if (!native.length) return false;
  if (!checked(p["Jenna Approved"]) || !checked(p["Publish Ready"]) || checked(p["Send to Buffer"])) return false;
  if (option(p.Status) !== "Approved" || option(p["Compliance Check"]) !== "Cleared") return false;
  if (option(p["Publishing Status"]) !== "Ready" || text(p["External Post ID"]) || text(p["Scheduler ID"])) return false;
  const when = new Date(dueAt(p)).getTime();
  return Number.isFinite(when) && when <= Date.now() + DUE_EARLY_MS && when >= Date.now() - DUE_LATE_MS;
}

async function readyPages() {
  const all = [];
  let start_cursor;
  do {
    const r = await notion.databases.query({ database_id: DATABASE_ID, page_size: 100, start_cursor });
    all.push(...r.results);
    start_cursor = r.has_more ? r.next_cursor : undefined;
  } while (start_cursor);
  return all.filter(eligible);
}

async function request(url, options = {}, label = "request") {
  const r = await fetch(url, options);
  const raw = await r.text();
  let body;
  try { body = raw ? JSON.parse(raw) : {}; } catch { body = raw; }
  if (!r.ok) throw new Error(`${label} HTTP ${r.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  return { body, headers: r.headers };
}

async function mediaAssets(p) {
  const url = p["Buffer Media URL"]?.url || "";
  if (!url) return [];
  if (/\.json(?:\?|$)/i.test(url)) {
    const { body } = await request(url, {}, "media manifest");
    if (!Array.isArray(body.assets)) throw new Error("Media manifest has no assets array");
    return body.assets.map((x) => ({ url: x.url, type: x.type || (/\.(mp4|mov|webm)(?:\?|$)/i.test(x.url) ? "video" : "image") }));
  }
  return [{ url, type: /\.(mp4|mov|m4v|webm)(?:\?|$)/i.test(url) ? "video" : "image" }];
}

function metaConfigured(platform) {
  const base = process.env.META_ACCESS_TOKEN;
  return Boolean(base && (platform === "Instagram" ? process.env.META_IG_USER_ID : process.env.META_PAGE_ID));
}

async function metaPost(path, values, label) {
  const form = new URLSearchParams({ ...values, access_token: process.env.META_ACCESS_TOKEN });
  return (await request(`https://graph.facebook.com/${META_VERSION}/${path}`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form,
  }, label)).body;
}

async function waitForInstagramContainer(id) {
  for (let i = 0; i < 30; i += 1) {
    const { body } = await request(`https://graph.facebook.com/${META_VERSION}/${id}?fields=status_code,status&access_token=${encodeURIComponent(process.env.META_ACCESS_TOKEN)}`, {}, "Instagram media status");
    if (body.status_code === "FINISHED") return;
    if (["ERROR", "EXPIRED"].includes(body.status_code)) throw new Error(`Instagram media failed: ${body.status || body.status_code}`);
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  throw new Error("Instagram media processing timed out");
}

async function createInstagramContainer(asset, extra = {}) {
  const values = { ...extra };
  if (asset.type === "video") values.video_url = asset.url;
  else values.image_url = asset.url;
  const body = await metaPost(`${process.env.META_IG_USER_ID}/media`, values, "Instagram create media");
  if (asset.type === "video") await waitForInstagramContainer(body.id);
  return body.id;
}

async function publishInstagram(p, copy, assets) {
  if (!assets.length) throw new Error("Instagram requires production media");
  const format = option(p.Format).toLowerCase();
  const published = [];
  if (format === "story") {
    for (const asset of assets) {
      const creation = await createInstagramContainer(asset, { media_type: "STORIES" });
      const result = await metaPost(`${process.env.META_IG_USER_ID}/media_publish`, { creation_id: creation }, "Instagram publish story");
      published.push(result.id);
    }
  } else if (assets.length > 1 || format === "carousel") {
    const children = [];
    for (const asset of assets) children.push(await createInstagramContainer(asset, { is_carousel_item: "true", ...(asset.type === "video" ? { media_type: "VIDEO" } : {}) }));
    const parent = await metaPost(`${process.env.META_IG_USER_ID}/media`, { media_type: "CAROUSEL", children: JSON.stringify(children), caption: copy }, "Instagram create carousel");
    const result = await metaPost(`${process.env.META_IG_USER_ID}/media_publish`, { creation_id: parent.id }, "Instagram publish carousel");
    published.push(result.id);
  } else {
    const asset = assets[0];
    const extra = asset.type === "video" || format === "reel" ? { media_type: "REELS", caption: copy, share_to_feed: "true" } : { caption: copy };
    const creation = await createInstagramContainer(asset, extra);
    const result = await metaPost(`${process.env.META_IG_USER_ID}/media_publish`, { creation_id: creation }, "Instagram publish");
    published.push(result.id);
  }
  return { id: published.join(","), url: published.length === 1 ? `https://www.instagram.com/p/${published[0]}/` : "https://www.instagram.com/" };
}

async function downloadAsset(asset) {
  const r = await fetch(asset.url);
  if (!r.ok) throw new Error(`Media download HTTP ${r.status}`);
  return { bytes: Buffer.from(await r.arrayBuffer()), type: r.headers.get("content-type") || (asset.type === "video" ? "video/mp4" : "image/jpeg") };
}

async function publishFacebook(p, copy, assets) {
  if (!assets.length) {
    const result = await metaPost(`${process.env.META_PAGE_ID}/feed`, { message: copy }, "Facebook publish text");
    return { id: result.id, url: `https://www.facebook.com/${result.id}` };
  }
  const asset = assets[0];
  if (asset.type !== "video") {
    const result = await metaPost(`${process.env.META_PAGE_ID}/photos`, { url: asset.url, caption: copy, published: "true" }, "Facebook publish photo");
    return { id: result.post_id || result.id, url: `https://www.facebook.com/${result.post_id || result.id}` };
  }
  const start = await metaPost(`${process.env.META_PAGE_ID}/video_reels`, { upload_phase: "start" }, "Facebook start reel");
  const { bytes, type } = await downloadAsset(asset);
  const upload = await fetch(start.upload_url, {
    method: "POST",
    headers: { Authorization: `OAuth ${process.env.META_ACCESS_TOKEN}`, offset: "0", file_size: String(bytes.length), "Content-Type": type },
    body: bytes,
  });
  if (!upload.ok) throw new Error(`Facebook reel upload HTTP ${upload.status}: ${await upload.text()}`);
  const finish = await metaPost(`${process.env.META_PAGE_ID}/video_reels`, {
    upload_phase: "finish", video_id: start.video_id, video_state: "PUBLISHED", description: copy,
  }, "Facebook publish reel");
  return { id: start.video_id, url: finish.post_url || `https://www.facebook.com/reel/${start.video_id}` };
}

async function googleAccessToken() {
  const form = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    grant_type: "refresh_token",
  });
  return (await request("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form }, "Google token refresh")).body.access_token;
}

async function publishYouTube(title, copy, assets) {
  const video = assets.find((x) => x.type === "video");
  if (!video) throw new Error("YouTube requires a video asset");
  const [token, file] = await Promise.all([googleAccessToken(), downloadAsset(video)]);
  const metadata = { snippet: { title: title.slice(0, 100), description: copy, categoryId: "27" }, status: { privacyStatus: "public", selfDeclaredMadeForKids: false } };
  const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Upload-Content-Type": file.type, "X-Upload-Content-Length": String(file.bytes.length) },
    body: JSON.stringify(metadata),
  });
  if (!init.ok) throw new Error(`YouTube upload initialization HTTP ${init.status}: ${await init.text()}`);
  const location = init.headers.get("location");
  if (!location) throw new Error("YouTube did not return an upload location");
  const result = await request(location, { method: "PUT", headers: { "Content-Type": file.type, "Content-Length": String(file.bytes.length) }, body: file.bytes }, "YouTube upload");
  return { id: result.body.id, url: `https://youtu.be/${result.body.id}` };
}

function linkedInHeaders(extra = {}) {
  return { Authorization: `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN}`, "LinkedIn-Version": LINKEDIN_VERSION, "X-Restli-Protocol-Version": "2.0.0", ...extra };
}

async function linkedInImage(asset) {
  const init = await request("https://api.linkedin.com/rest/images?action=initializeUpload", {
    method: "POST", headers: linkedInHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ initializeUploadRequest: { owner: process.env.LINKEDIN_AUTHOR_URN } }),
  }, "LinkedIn initialize image");
  const file = await downloadAsset(asset);
  await request(init.body.value.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file.bytes }, "LinkedIn upload image");
  return init.body.value.image;
}

async function linkedInVideo(asset) {
  const file = await downloadAsset(asset);
  const init = await request("https://api.linkedin.com/rest/videos?action=initializeUpload", {
    method: "POST", headers: linkedInHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ initializeUploadRequest: { owner: process.env.LINKEDIN_AUTHOR_URN, fileSizeBytes: file.bytes.length, uploadCaptions: false, uploadThumbnail: false } }),
  }, "LinkedIn initialize video");
  const ids = [];
  for (const part of init.body.value.uploadInstructions) {
    const chunk = file.bytes.subarray(part.firstByte, Math.min(part.lastByte + 1, file.bytes.length));
    const uploaded = await fetch(part.uploadUrl, { method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: chunk });
    if (!uploaded.ok) throw new Error(`LinkedIn video upload HTTP ${uploaded.status}: ${await uploaded.text()}`);
    const etag = uploaded.headers.get("etag");
    if (etag) ids.push(etag.replace(/^\"|\"$/g, ""));
  }
  await request("https://api.linkedin.com/rest/videos?action=finalizeUpload", {
    method: "POST", headers: linkedInHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ finalizeUploadRequest: { video: init.body.value.video, uploadToken: init.body.value.uploadToken || "", uploadedPartIds: ids } }),
  }, "LinkedIn finalize video");
  return init.body.value.video;
}

async function publishLinkedIn(title, copy, assets) {
  const payload = {
    author: process.env.LINKEDIN_AUTHOR_URN,
    commentary: copy.slice(0, 3000),
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };
  if (assets[0]) {
    const id = assets[0].type === "video" ? await linkedInVideo(assets[0]) : await linkedInImage(assets[0]);
    payload.content = { media: { title: title.slice(0, 200), id } };
  }
  const result = await request("https://api.linkedin.com/rest/posts", {
    method: "POST", headers: linkedInHeaders({ "Content-Type": "application/json" }), body: JSON.stringify(payload),
  }, "LinkedIn publish");
  const id = result.headers.get("x-restli-id") || result.body.id;
  if (!id) throw new Error("LinkedIn did not return a post ID");
  return { id, url: `https://www.linkedin.com/feed/update/${encodeURIComponent(id)}/` };
}

function configured(platform) {
  if (["Instagram", "Facebook"].includes(platform)) return metaConfigured(platform);
  if (platform === "YouTube Shorts") return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN);
  if (platform === "LinkedIn") return Boolean(process.env.LINKEDIN_ACCESS_TOKEN && process.env.LINKEDIN_AUTHOR_URN);
  return false;
}

async function markPublished(pageId, platform, result) {
  await notion.pages.update({ page_id: pageId, properties: {
    "External Post ID": { rich_text: [{ text: { content: `${platform}:${result.id}` } }] },
    "Scheduler ID": { rich_text: [{ text: { content: `${platform}:${result.id}` } }] },
    "Published URL": { url: result.url || null },
    "Published At": { date: { start: new Date().toISOString() } },
    "Publishing Status": { select: { name: "Published" } },
    "Status": { select: { name: "Published" } },
    "CoreAxis Automation Status": { select: { name: "Synced" } },
    "Publishing Error": { rich_text: [] },
    "Buffer Error": { rich_text: [] },
  } });
}

async function markFailure(pageId, message) {
  await notion.pages.update({ page_id: pageId, properties: {
    "Publishing Error": { rich_text: [{ text: { content: String(message).slice(0, 1900) } }] },
  } });
}

async function main() {
  const pages = await readyPages();
  console.log(`[NATIVE] ${pages.length} due native record(s)`);
  let failures = 0;
  for (const page of pages) {
    const p = page.properties;
    const title = text(p["Content Title"]) || page.id;
    const copy = cleanCopy(text(p["Full Copy"]));
    const platform = platforms(p.Platform).find((x) => ["Instagram", "Facebook", "LinkedIn", "YouTube Shorts"].includes(x));
    if (!configured(platform)) {
      console.warn(`[NATIVE] ${platform} is not authorized; leaving "${title}" Ready.`);
      continue;
    }
    try {
      if (!copy) throw new Error("Full Copy is empty");
      const assets = await mediaAssets(p);
      let result;
      if (platform === "Instagram") result = await publishInstagram(p, copy, assets);
      else if (platform === "Facebook") result = await publishFacebook(p, copy, assets);
      else if (platform === "YouTube Shorts") result = await publishYouTube(title, copy, assets);
      else result = await publishLinkedIn(title, copy, assets);
      await markPublished(page.id, platform, result);
      console.log(`[NATIVE] Published "${title}" to ${platform}: ${result.id}`);
    } catch (error) {
      failures += 1;
      console.error(`[NATIVE] "${title}" failed: ${error.message}`);
      await markFailure(page.id, error.message);
    }
  }
  if (failures) throw new Error(`${failures} native record(s) failed; see Publishing Error in Notion.`);
}

main().catch((error) => { console.error("[FATAL]", error.message); process.exit(1); });
