import { Client } from "@notionhq/client";
import fetch from "node-fetch";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const BUFFER_API_KEY = process.env.BUFFER_API_KEY;
const DATABASE_ID = "252649c1-4370-4cbc-9f08-7c708f0d970c";

async function main() {
  console.log("🚀 CoreAxis Buffer Sync Starting...");

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

  console.log(`Eligible records: ${response.results.length}`);

  for (const page of response.results) {
    const title = page.properties["Content Title"]?.title?.[0]?.plain_text || "Untitled";
    const fullCopy = page.properties["Full Copy"]?.rich_text?.[0]?.plain_text || "CoreAxis launch content.";
    const mediaUrl = page.properties["Buffer Media URL"]?.url || null;

    try {
      // Buffer setup
      const account = await callBuffer(`query { account { organizations { id } } }`);
      const orgId = account.data.account.organizations[0].id;

      const channels = await callBuffer(`query GetCh($o:ID!){channels(input:{organizationId:$o}){id name service}}`, {o: orgId});
      const channel = channels.data.channels.find(c => c.service.includes("instagram"));
      if (!channel) throw new Error("No IG channel");

      console.log(`Posting to ${channel.name} (${channel.id})`);

      const postRes = await callBuffer(`
        mutation($i:CreatePostInput!){createPost(input:$i){...on PostActionSuccess{post{id}} ...on MutationError{message}}}
      `, {
        i: {
          text: fullCopy,
          channelId: channel.id,
          schedulingType: "automatic",
          mode: "addToQueue"
        }
      });

      const postId = postRes.data.createPost.post?.id;
      if (postId) {
        await notion.pages.update({
          page_id: page.id,
          properties: {
            "Buffer Channel IDs": {rich_text: [{text:{content: channel.id}}]},
            "Buffer Post IDs": {rich_text: [{text:{content: postId}}]},
            "CoreAxis Automation Status": {select:{name:"Completed"}},
            "Publishing Status": {select:{name:"Queued"}}
          }
        });
        console.log(`✅ SUCCESS: ${postId}`);
      }
    } catch (e) {
      console.error("❌", title, e.message);
    }
  }
}

async function callBuffer(query, vars={}) {
  const r = await fetch("https://api.buffer.com/graphql", {
    method:"POST",
    headers: {"Authorization":`Bearer ${BUFFER_API_KEY}`,"Content-Type":"application/json"},
    body: JSON.stringify({query, variables:vars})
  });
  const j = await r.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors));
  return j;
}

main().catch(console.error);
