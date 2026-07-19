import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DATABASE_ID = (process.env.NOTION_DATABASE_ID || "252649c1-4370-4cbc-9f08-7c708f0d970c").trim();

console.log("Using DB ID:", DATABASE_ID, "Length:", DATABASE_ID.length);

async function main() {
  console.log("🚀 Starting sync...");

  try {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
      filter: {
        and: [
          { property: "Publish Ready", rich_text: { contains: "YES" } },
          { property: "Send to Buffer", rich_text: { contains: "YES" } },
          { property: "CoreAxis Automation Status", select: { equals: "Ready" } }
        ]
      }
    });

    console.log(`✅ Query success - Eligible records: ${response.results.length}`);
    // Add full Buffer logic here once query confirmed working
  } catch (error) {
    console.error("❌ Notion error:", error.message);
    if (error.code) console.error("Code:", error.code);
  }
}

main().catch(console.error);
