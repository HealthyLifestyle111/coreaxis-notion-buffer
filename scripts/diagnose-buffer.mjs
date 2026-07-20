const BUFFER_API_KEY = process.env.BUFFER_API_KEY;
const API = "https://api.buffer.com";
const TARGET_POST_ID = "6a5d0ce3a530934802240b39";
const EXPECTED_X_CHANNEL_ID = "6a58bf3a80cc80cdcac4c2a9";

if (!BUFFER_API_KEY) {
  console.error("[FATAL] BUFFER_API_KEY is missing.");
  process.exit(1);
}

async function gql(label, query, variables = {}) {
  const response = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${BUFFER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await response.json().catch(() => ({}));
  console.log(`[${label}] HTTP ${response.status}`);
  if (body.errors?.length) {
    console.log(`[${label}] GraphQL errors: ${body.errors.map((e) => e.message).join("; ")}`);
    return null;
  }
  if (!response.ok) {
    console.log(`[${label}] Body: ${JSON.stringify(body)}`);
    return null;
  }
  return body.data;
}

const orgData = await gql(
  "ORGANIZATIONS",
  `query GetOrganizations { account { organizations { id name } } }`,
);
const organizations = orgData?.account?.organizations || [];
console.log(`[ORGANIZATIONS] ${organizations.length} found`);

let targetSeen = false;
let xChannelFound = false;

for (const organization of organizations) {
  console.log(`[ORGANIZATION] ${organization.name} (${organization.id})`);
  const channelData = await gql(
    "CHANNELS",
    `query GetChannels($organizationId: OrganizationId!) {
      channels(input: { organizationId: $organizationId }) {
        id name displayName service isDisconnected isLocked
      }
    }`,
    { organizationId: organization.id },
  );
  const channels = channelData?.channels || [];
  for (const channel of channels) {
    console.log(`[CHANNEL] id=${channel.id} service=${channel.service} name=${channel.displayName || channel.name} disconnected=${channel.isDisconnected} locked=${channel.isLocked}`);
    if (channel.id === EXPECTED_X_CHANNEL_ID && !channel.isDisconnected && !channel.isLocked) xChannelFound = true;
  }

  for (const status of ["scheduled", "sent"]) {
    const postsData = await gql(
      `POSTS_${status.toUpperCase()}`,
      `query GetPosts($organizationId: OrganizationId!) {
        posts(first: 100, input: {
          organizationId: $organizationId,
          filter: { status: [${status}] },
          sort: [{ field: dueAt, direction: asc }]
        }) {
          edges { node { id text status dueAt channelId } }
        }
      }`,
      { organizationId: organization.id },
    );
    const posts = postsData?.posts?.edges?.map((edge) => edge.node) || [];
    console.log(`[POSTS_${status.toUpperCase()}] ${posts.length} found`);
    for (const post of posts) {
      console.log(`[POST] id=${post.id} status=${post.status} dueAt=${post.dueAt} channelId=${post.channelId} text=${JSON.stringify((post.text || "").slice(0, 120))}`);
      if (post.id === TARGET_POST_ID) targetSeen = true;
    }
  }
}

const targetData = await gql(
  "TARGET_POST",
  `query GetTargetPost {
    post(input: { id: "${TARGET_POST_ID}" }) {
      id text status dueAt channelId
      metadata {
        ... on TwitterPostMetadata { thread { text } }
      }
    }
  }`,
);
if (targetData?.post) {
  targetSeen = true;
  console.log(`[TARGET_POST] ${JSON.stringify(targetData.post)}`);
} else {
  console.log("[TARGET_POST] Not returned by Buffer.");
}

console.log(`[VERDICT] expectedXChannelConnected=${xChannelFound} targetPostExists=${targetSeen}`);
if (!xChannelFound || !targetSeen) process.exitCode = 2;
