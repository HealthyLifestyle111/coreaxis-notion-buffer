import { Client } from "@notionhq/client";
import fetch from "node-fetch";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DATABASE_ID = (process.env.NOTION_DATABASE_ID || "252649c1-4370-4cbc-9f08-7c708f0d970c").trim();

async function main() {
  console.log("Using DB:", DATABASE_ID);

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

  console.log(`Eligible: ${response.results.length}`);

  for (const page of response.results) {
    const fullCopy = page.properties["Full Copy"]?.rich_text?.[0]?.plain_text || "Monday launch from CoreAxis.";
    try {
      const account = await callBuffer(`query { account { organizations { id } } }`);
      const orgId = account.data.account.organizations[0].id;

      const channels = await callBuffer(`query($o:ID!){channels(input:{organizationId:$o}){id name service}}`, {o: orgId});
      const channel = channels.data.channels.find(c => c.service.includes("instagram"));
      if (!channel) throw new Error("No IG");

      const postRes = await callBuffer(`
        mutation($i:CreatePostInput!){createPost(input:$i){...on PostActionSuccess{post{id}}...on MutationError{message}}}
      `, {i: {text: fullCopy, channelId: channel.id, schedulingType: "automatic", mode: "addToQueue"}});

      const postId = postRes.data.createPost.post?.id;
      if (postId) {
        await notion.pages.update({page_id: page.id, properties: {
          "Buffer Channel IDs": {rich_text: [{text:{content: channel.id}}]},
          "Buffer Post IDs": {rich_text: [{text:{content: postId}}]},
          "CoreAxis Automation Status": {select:{name:"Completed"}}
        }});
        console.log("✅ Posted:", postId);
      }
    } catch (e) {
      console.error("Error:", e.message);
    }
  }
}

async function callBuffer(query, vars = {}) {
  const r = await fetch("https://api.buffer.com/graphql", {
    method: "POST",
    headers: {"Authorization": `Bearer ${process.env.BUFFER_API_KEY}`, "Content-Type": "application/json"},
    body: JSON.stringify({query, variables: vars})
  });
  const j = await r.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors));
  return j;
}

main().catch(console.error);
