import { Client } from "@notionhq/client";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID || "2fc38cda2cba491cb090d4f09d0ec1d2";

if (!NOTION_TOKEN) {
  console.error("[FATAL] NOTION_TOKEN must be set.");
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });

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
  return (blocks || []).map((block) => block.plain_text || "").join("").trim();
}

function urlValue(property) {
  return property?.type === "url" ? property.url || "" : "";
}

function dateValue(property) {
  return property?.type === "date" ? property.date?.start || "" : "";
}

function platforms(property) {
  return property?.type === "multi_select" ? property.multi_select.map((item) => item.name) : [];
}

function containsUrl(value) {
  return /https?:\/\/\S+/i.test(value || "");
}

function containsHashtag(value) {
  return /(^|\s)#[A-Za-z0-9_]+/.test(value || "");
}

function futureOrToday(dateText) {
  if (!dateText) return false;
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() >= Date.now() - 24 * 60 * 60 * 1000;
}

function validate(page) {
  const p = page.properties || {};
  const title = textValue(p["Content Title"]) || page.id;
  const copy = textValue(p["Full Copy"]);
  const selectedPlatforms = platforms(p["Platform"]).filter((name) => name !== "Email");
  const format = optionName(p["Format"]);
  const status = optionName(p["Status"]);
  const publishingStatus = optionName(p["Publishing Status"]);
  const automationStatus = optionName(p["CoreAxis Automation Status"]);
  const route = optionName(p["Distribution Route"]) || textValue(p["Distribution Route"]);
  const scheduled = dateValue(p["Scheduled Time"]) || dateValue(p["Buffer Publish At"]) || dateValue(p["Date"]);
  const utm = urlValue(p["UTM Link"]) || textValue(p["UTM Link"]);
  const media = urlValue(p["Buffer Media URL"]);
  const cta = textValue(p["Primary CTA"]);
  const ctaAlignment = textValue(p["CTA Alignment"]);
  const firstComment = textValue(p["Meta Safe Copy"]);
  const schedulerId = textValue(p["Scheduler ID"]);
  const disclosureRequired = checked(p["Affiliate Disclosure"]) || checked(p["Prescription Drug Risk"]) || checked(p["Medical Claim Risk"]);
  const errors = [];

  const isManual = /manual/i.test(route) || selectedPlatforms.every((name) => name === "Facebook");
  const isMetricool = /metricool|external video/i.test(route) || selectedPlatforms.some((name) => ["Instagram", "TikTok", "YouTube", "YouTube Shorts"].includes(name));
  const isBuffer = !isManual && !isMetricool;

  if (!copy && format !== "Story") errors.push("Full Copy is empty");
  if (!selectedPlatforms.length) errors.push("No social platform is selected");
  if (!scheduled || !futureOrToday(scheduled)) errors.push("No current/future Pulse publication time is set");
  if (!cta) errors.push("Primary CTA is missing");
  if (!containsUrl(copy) && !containsUrl(utm) && !/link in bio/i.test(copy)) errors.push("No destination path exists in copy or UTM Link");
  if (/PENDING|PLACEHOLDER|TBD|\{\{|\[insert/i.test(`${copy} ${utm} ${ctaAlignment}`)) errors.push("Placeholder or pending destination remains");

  const hashtagPlatforms = selectedPlatforms.filter((name) => ["Instagram", "TikTok", "Facebook", "Pinterest", "YouTube", "YouTube Shorts"].includes(name));
  if (hashtagPlatforms.length && format !== "Story" && !containsHashtag(copy)) errors.push(`Platform hashtags missing for ${hashtagPlatforms.join(", ")}`);

  const mediaPlatforms = selectedPlatforms.filter((name) => ["Instagram", "TikTok", "Pinterest", "YouTube", "YouTube Shorts"].includes(name));
  if (mediaPlatforms.length && !media) errors.push(`Public media URL missing for ${mediaPlatforms.join(", ")}`);

  if (selectedPlatforms.includes("Instagram")) {
    if (/link in bio/i.test(copy) && !containsUrl(utm)) errors.push("Instagram relies on an unverified bio path");
    if (format !== "Story" && !firstComment && !/first comment/i.test(ctaAlignment)) errors.push("Instagram first comment is missing");
    if (format === "Story" && !/link sticker/i.test(`${copy} ${ctaAlignment}`)) errors.push("Instagram Story link-sticker instruction is missing");
  }

  if (selectedPlatforms.includes("LinkedIn") && containsHashtag(copy)) errors.push("LinkedIn copy contains hashtags against the approved standard");

  if (selectedPlatforms.includes("X") && String(format).toLowerCase() === "thread") {
    errors.push("X is configured as a thread; launch cadence requires separate drops unless explicitly reapproved");
  }

  if (disclosureRequired && !/(educational|not medical|affiliate|provider determines eligibility|individual results vary|not intended to diagnose|prescription)/i.test(copy)) {
    errors.push("Required disclosure language is missing");
  }

  if (["Scheduled", "Published"].includes(status) || ["Queued", "Published"].includes(publishingStatus) || automationStatus === "Synced") {
    if (!schedulerId && !isManual) errors.push("Record claims scheduled/synced without a Scheduler ID");
  }

  if (!checked(p["Jenna Approved"])) errors.push("Jenna Approved is not checked");
  if (!checked(p["Publish Ready"])) errors.push("Publish Ready is not checked");
  if (optionName(p["Compliance Check"]) !== "Cleared") errors.push("Compliance Check is not Cleared");
  if (optionName(p["Affirmative Framing Review"]) !== "Meets Standard") errors.push("Affirmative Framing Review is incomplete");
  if (optionName(p["Scope Separation Review"]) !== "Meets Standard") errors.push("Scope Separation Review is incomplete");

  return { title, errors, route: isManual ? "manual" : isMetricool ? "metricool" : isBuffer ? "buffer" : "unknown" };
}

async function allPages() {
  const pages = [];
  let start_cursor;
  do {
    const response = await notion.databases.query({ database_id: NOTION_DATABASE_ID, page_size: 100, start_cursor });
    pages.push(...response.results);
    start_cursor = response.has_more ? response.next_cursor : undefined;
  } while (start_cursor);
  return pages;
}

async function markFailed(page, errors) {
  const message = `PUBLISHING GATE FAILED: ${errors.join(" | ")}`.slice(0, 1900);
  await notion.pages.update({
    page_id: page.id,
    properties: {
      "Status": { select: { name: "Hold" } },
      "Publishing Status": { select: { name: "Failed" } },
      "CoreAxis Automation Status": { select: { name: "Error" } },
      "Send to Buffer": { checkbox: false },
      "Publishing Error": { rich_text: [{ text: { content: message } }] },
      "Buffer Error": { rich_text: [{ text: { content: message } }] },
    },
  });
}

async function main() {
  const pages = await allPages();
  const candidates = pages.filter((page) => {
    const p = page.properties || {};
    const status = optionName(p["Status"]);
    const publishingStatus = optionName(p["Publishing Status"]);
    const scheduled = dateValue(p["Scheduled Time"]) || dateValue(p["Buffer Publish At"]) || dateValue(p["Date"]);
    return ["Approved", "Scheduled"].includes(status) || ["Ready", "Queued"].includes(publishingStatus) || futureOrToday(scheduled);
  });

  let failed = 0;
  for (const page of candidates) {
    const result = validate(page);
    if (!result.errors.length) {
      console.log(`[PASS:${result.route}] ${result.title}`);
      continue;
    }
    failed += 1;
    console.error(`[FAIL:${result.route}] ${result.title}: ${result.errors.join("; ")}`);
    await markFailed(page, result.errors);
  }

  console.log(`[VALIDATION] Checked ${candidates.length} active record(s); ${failed} failed and were placed on Hold.`);
  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error("[FATAL]", error.message);
  process.exit(1);
});