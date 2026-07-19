import { Client } from "@notionhq/client";
import fetch from "node-fetch";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DATABASE_ID =
  process.env.NOTION_DATABASE_ID || "252649c1-4370-4cbc-9f08-7c708f0d970c";
const BUFFER_API_KEY = process.env.BUFFER_API_KEY;

// Validate environment
console.log("[INIT] Starting Notion Buffer Sync...");
console.log("[ENV] NOTION_DATABASE_ID:", NOTION_DATABASE_ID);
console.log("[ENV] NOTION_TOKEN:", NOTION_TOKEN ? "✓ Set" : "✗ MISSING");
console.log("[ENV] BUFFER_API_KEY:", BUFFER_API_KEY ? "✓ Set" : "✗ MISSING");

if (!NOTION_TOKEN) {
  console.error("[ERROR] Missing NOTION_TOKEN");
  process.exit(1);
}

if (!BUFFER_API_KEY) {
  console.error("[ERROR] Missing BUFFER_API_KEY");
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });

/**
 * Query Notion database for records ready to send to Buffer
 */
async function queryNotionDatabase() {
  try {
    console.log("[NOTION] Querying database:", NOTION_DATABASE_ID);

    const response = await notion.databases.query({
      database_id: NOTION_DATABASE_ID,
      filter: {
        and: [
          {
            property: "Publish Ready",
            checkbox: { equals: true },
          },
          {
            property: "Send to Buffer",
            checkbox: { equals: true },
          },
          {
            property: "CoreAxis Automation Status",
            status: { equals: "Ready" },
          },
        ],
      },
    });

    console.log(`[NOTION] Found ${response.results.length} records to process`);
    return response.results;
  } catch (error) {
    console.error("[ERROR] Failed to query Notion database:", error.message);
    throw error;
  }
}

/**
 * Get Buffer organization and Instagram channel
 */
async function getBufferOrgAndChannel() {
  try {
    console.log("[BUFFER] Fetching organization...");

    const orgResponse = await fetch("https://api.bufferapp.com/1/user.json", {
      headers: { Authorization: `Bearer ${BUFFER_API_KEY}` },
    });

    if (!orgResponse.ok) {
      throw new Error(
        `Buffer API error: ${orgResponse.status} ${orgResponse.statusText}`
      );
    }

    const user = await orgResponse.json();
    console.log("[BUFFER] User:", user.id);

    if (!user.twitter_id) {
      throw new Error("No Buffer organization found for this API key");
    }

    // Get profiles to find Instagram channel
    console.log("[BUFFER] Fetching profiles...");
    const profilesResponse = await fetch(
      `https://api.bufferapp.com/1/profiles.json`,
      {
        headers: { Authorization: `Bearer ${BUFFER_API_KEY}` },
      }
    );

    if (!profilesResponse.ok) {
      throw new Error(
        `Buffer API error: ${profilesResponse.status} ${profilesResponse.statusText}`
      );
    }

    const profiles = await profilesResponse.json();
    const instagramProfile = profiles.find(
      (p) => p.service === "instagram"
    );

    if (!instagramProfile) {
      throw new Error(
        "No Instagram profile found in Buffer account. Please connect one."
      );
    }

    console.log("[BUFFER] Instagram profile ID:", instagramProfile.id);
    return {
      orgId: user.twitter_id,
      channelId: instagramProfile.id,
    };
  } catch (error) {
    console.error("[ERROR] Failed to get Buffer org/channel:", error.message);
    throw error;
  }
}

/**
 * Extract text from Notion rich text field
 */
function extractTextFromRichText(richTextArray) {
  if (!Array.isArray(richTextArray)) return "";
  return richTextArray.map((block) => block.plain_text).join("");
}

/**
 * Post to Buffer and return post ID
 */
async function postToBuffer(
  channelId,
  text,
  media = null
) {
  try {
    console.log(`[BUFFER] Creating post to channel ${channelId}...`);

    const payload = {
      profile_ids: [channelId],
      text: text,
      now: true,
    };

    if (media) {
      payload.media = {
        link: media,
      };
    }

    const response = await fetch("https://api.bufferapp.com/1/updates/create.json", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${BUFFER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Buffer API error: ${response.status} ${JSON.stringify(error)}`
      );
    }

    const result = await response.json();
    console.log("[BUFFER] Post created successfully, ID:", result.success);
    return result.success;
  } catch (error) {
    console.error("[ERROR] Failed to post to Buffer:", error.message);
    throw error;
  }
}

/**
 * Update Notion page with Buffer post ID
 */
async function updateNotionWithBufferId(pageId, bufferId) {
  try {
    console.log(`[NOTION] Updating page ${pageId} with Buffer ID...`);

    await notion.pages.update({
      page_id: pageId,
      properties: {
        "Buffer Post ID": {
          rich_text: [
            {
              text: {
                content: bufferId,
              },
            },
          ],
        },
        "CoreAxis Automation Status": {
          status: {
            name: "Sent",
          },
        },
      },
    });

    console.log("[NOTION] Page updated successfully");
  } catch (error) {
    console.error("[ERROR] Failed to update Notion page:", error.message);
    throw error;
  }
}

/**
 * Main sync function
 */
async function main() {
  try {
    console.log("\n=== Starting Sync ===\n");

    // Get Notion records
    const records = await queryNotionDatabase();

    if (records.length === 0) {
      console.log("[SYNC] No records to process");
      return;
    }

    // Get Buffer channel
    const { channelId } = await getBufferOrgAndChannel();

    // Process each record
    let successCount = 0;
    let failCount = 0;

    for (const page of records) {
      try {
        console.log(`\n[SYNC] Processing: ${page.id}`);

        // Extract Full Copy from Notion
        const fullCopy = page.properties["Full Copy"];
        if (!fullCopy || fullCopy.type !== "rich_text") {
          console.warn(
            "[WARN] No Full Copy property found, skipping"
          );
          continue;
        }

        const postText = extractTextFromRichText(fullCopy.rich_text);

        if (!postText) {
          console.warn("[WARN] Empty post text, skipping");
          continue;
        }

        console.log(`[SYNC] Post text: ${postText.substring(0, 50)}...`);

        // Post to Buffer
        const bufferId = await postToBuffer(channelId, postText);

        // Update Notion with Buffer ID
        await updateNotionWithBufferId(page.id, bufferId);

        console.log(`[SYNC] ✓ Successfully processed record`);
        successCount++;
      } catch (recordError) {
        console.error(
          `[SYNC] ✗ Failed to process record: ${recordError.message}`
        );
        failCount++;
      }
    }

    console.log(`\n=== Sync Complete ===`);
    console.log(`[RESULT] Success: ${successCount}, Failed: ${failCount}`);

    if (failCount > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("[FATAL]", error);
    process.exit(1);
  }
}

main();
