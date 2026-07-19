const API = "https://api.buffer.com";
const KEY = process.env.BUFFER_API_KEY;
if (!KEY) throw new Error("BUFFER_API_KEY is missing.");

const records = [
  {
    "pageId": "3a1f092e-8fae-812d-9ac9-d0e38cd969d7",
    "platform": "X",
    "format": "Thread",
    "title": "The life you built deserves a smarter next chapter",
    "dueAt": "2026-07-20T15:30:00.000Z",
    "media": "https://coreaxis-launch-review.jennalwill.chatgpt.site/media/week/modern-motion-one.png",
    "text": "1/ You have changed before. This time, you get to move forward with more information.\n\n2/ Midlife rarely arrives as one isolated concern. Sleep, focus, nourishment, stress load and body changes can influence the same week.\n\n3/ Ask what changed first, what affects daily life most and what you want to protect next.\n\n4/ Menopause Core organizes nutrition education, lifestyle strategy and whole-pattern context without replacing licensed medical care.\n\n5/ Begin with the 90-second assessment: https://www.coreaxishealth.com/menopause-core?utm_source=x&utm_medium=organic_social&utm_campaign=week01_20260720&utm_content=monday_thread"
  },
  {
    "pageId": "3a1f092e-8fae-8166-a26a-f20d94a0cab3",
    "platform": "Instagram",
    "format": "Reel",
    "title": "The life you built deserves a smarter next chapter",
    "dueAt": "2026-07-20T15:35:00.000Z",
    "media": "https://coreaxis-launch-review.jennalwill.chatgpt.site/media/refresh/coreaxis-second-spring-approval-reel.mp4",
    "text": "You have changed before. This time, you get to move forward with more information.\n\nMidlife support should recognize what changed, what matters now and what you want to protect next. Menopause Core brings nutrition education, lifestyle strategy and whole-pattern context together around your priorities—not a generic protocol.\n\nTake the 90-second assessment through the link in bio.\n\nEducational wellness content; not medical care."
  },
  {
    "pageId": "3a1f092e-8fae-8186-b164-d7dedee7562f",
    "platform": "TikTok",
    "format": "Reel",
    "title": "The life you built deserves a smarter next chapter",
    "dueAt": "2026-07-20T15:55:00.000Z",
    "media": "https://coreaxis-launch-review.jennalwill.chatgpt.site/media/refresh/coreaxis-second-spring-approval-reel.mp4",
    "text": "Before choosing a midlife-wellness program, answer three questions: What changed first? What affects daily life most? What do you want to protect next? Those answers are more useful than another generic checklist.\n\nBegin with the 90-second Menopause Core assessment through the link in bio. Educational wellness content; not medical care."
  },
  {
    "pageId": "3a1f092e-8fae-81f8-a09d-d99ed709ac2a",
    "platform": "YouTube Shorts",
    "format": "Reel",
    "title": "The question before the plan | Menopause Core",
    "dueAt": "2026-07-20T16:15:00.000Z",
    "media": "https://coreaxis-launch-review.jennalwill.chatgpt.site/media/refresh/coreaxis-second-spring-approval-reel.mp4",
    "text": "The question before the plan: What changed first? What affects real life? What matters for the decade ahead? Menopause Core begins with those connections.\n\nTake the 90-second assessment: https://www.coreaxishealth.com/menopause-core?utm_source=youtube_shorts&utm_medium=organic_video&utm_campaign=week01_20260720&utm_content=monday_second_spring\n\nContinue the conversation in the CoreAxis Longevity YouTube Community: https://youtube.com/@coreaxis-longevity/community?si=czHtw65DW4Vk2Vu1\n\nEducational wellness content; not medical care."
  },
  {
    "pageId": "3a1f092e-8fae-812e-86cf-cce26bb2bae2",
    "platform": "Instagram",
    "format": "Carousel",
    "title": "Your next chapter deserves more than a checklist",
    "dueAt": "2026-07-20T18:30:00.000Z",
    "media": "https://coreaxis-launch-review.jennalwill.chatgpt.site/media/launch-monday/carousel.json",
    "text": "Your next chapter deserves more than a checklist.\n\nName the sequence. Connect it to real life. Keep wellness support clearly separated from medical care. Then choose one useful next step.\n\nTake the 90-second Menopause Core assessment through the link in bio.\n\nEducational wellness content; not medical care."
  },
  {
    "pageId": "3a1f092e-8fae-812e-b8ec-e32aed387ac3",
    "platform": "Facebook",
    "format": "Reel",
    "title": "The life you built deserves a smarter next chapter",
    "dueAt": "2026-07-21T00:05:00.000Z",
    "media": "https://coreaxis-launch-review.jennalwill.chatgpt.site/media/refresh/coreaxis-second-spring-approval-reel.mp4",
    "text": "Midlife support should recognize the life you already built. Begin with what changed, what matters now and what you want to protect next. Menopause Core brings those answers into one organized wellness framework.\n\nTake the 90-second assessment: https://www.coreaxishealth.com/menopause-core?utm_source=facebook&utm_medium=organic_reel&utm_campaign=week01_20260720&utm_content=monday_second_spring\n\nEducational wellness content; not medical care."
  },
  {
    "pageId": "3a1f092e-8fae-8113-83d4-d25751246260",
    "platform": "Instagram",
    "format": "Story",
    "title": "Your pattern is the beginning",
    "dueAt": "2026-07-21T00:25:00.000Z",
    "media": "https://coreaxis-launch-review.jennalwill.chatgpt.site/media/launch-monday/story.json",
    "text": "What changed first? What affects your day most? What do you want to protect next? Your pattern is the beginning. Take the 90-second assessment."
  }
];

async function gql(query, variables = {}) {
  const response = await fetch(API, {method:"POST",headers:{Authorization:`Bearer ${KEY}`,"Content-Type":"application/json"},body:JSON.stringify({query,variables})});
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.errors?.length) throw new Error(`Buffer error: ${JSON.stringify(body)}`);
  return body.data;
}

async function channels() {
  const orgData = await gql(`query { account { organizations { id name } } }`);
  const result = [];
  for (const org of orgData.account.organizations) {
    const data = await gql(`query ($organizationId: OrganizationId!) { channels(input:{organizationId:$organizationId}) { id name displayName service isDisconnected isLocked } }`, {organizationId:org.id});
    result.push(...data.channels.filter(c => !c.isDisconnected && !c.isLocked));
  }
  return result;
}

const services = {Instagram:["instagram"],Facebook:["facebook"],TikTok:["tiktok"],"YouTube Shorts":["youtube"],X:["twitter","x"]};
function findChannel(all, platform) {
  return all.find(c => services[platform].includes(String(c.service).toLowerCase()));
}
function splitThread(text) {
  return text.split(/\n\s*\n(?=\d+\/\s)/).map(x => x.trim()).filter(Boolean);
}
async function assets(url) {
  if (url.endsWith(".json")) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Media manifest failed: ${response.status}`);
    const manifest = await response.json();
    return manifest.assets.map(a => a.type === "video" ? {video:{url:a.url,metadata:{thumbnailOffset:a.thumbnailOffset||1500}}} : {image:{url:a.url}});
  }
  return /\.mp4$/i.test(url) ? [{video:{url,metadata:{thumbnailOffset:1500}}}] : [{image:{url}}];
}
function metadata(record) {
  if (record.platform === "X") return {twitter:{thread:splitThread(record.text).map(text => ({text}))}};
  if (record.platform === "Instagram") return {instagram:{type:record.format === "Story" ? "story" : record.format === "Reel" ? "reel" : "post",shouldShareToFeed:record.format === "Reel",isAiGenerated:true}};
  if (record.platform === "Facebook") return {facebook:{type:record.format === "Reel" ? "reel" : "post"}};
  if (record.platform === "TikTok") return {tiktok:{type:"post",isAiGenerated:true}};
  if (record.platform === "YouTube Shorts") return {youtube:{title:record.title.slice(0,100),privacy:"public",categoryId:"27",madeForKids:false,isAiGenerated:true}};
}
async function create(record, channel) {
  const input = {
    text:record.platform === "X" ? splitThread(record.text)[0] : record.text,
    channelId:channel.id,
    schedulingType:"automatic",
    mode:"customScheduled",
    dueAt:record.dueAt,
    assets:await assets(record.media),
    metadata:metadata(record)
  };
  const data = await gql(`mutation ($input: CreatePostInput!) { createPost(input:$input) { __typename ... on PostActionSuccess { post { id dueAt status } } ... on MutationError { message } } }`, {input});
  if (data.createPost?.__typename !== "PostActionSuccess") throw new Error(data.createPost?.message || "Buffer rejected the post");
  return data.createPost.post;
}

const all = await channels();
console.log("CHANNELS", JSON.stringify(all.map(c => ({id:c.id,service:c.service,name:c.displayName||c.name}))));
let failures = 0;
for (const record of records) {
  const channel = findChannel(all, record.platform);
  if (!channel) {
    console.log("UNCONNECTED", JSON.stringify({pageId:record.pageId,platform:record.platform}));
    continue;
  }
  try {
    const post = await create(record, channel);
    console.log("SCHEDULED", JSON.stringify({pageId:record.pageId,platform:record.platform,postId:post.id,dueAt:post.dueAt,status:post.status}));
  } catch (error) {
    failures++;
    console.error("FAILED", JSON.stringify({pageId:record.pageId,platform:record.platform,error:error.message}));
  }
}
if (failures) process.exitCode = 1;
