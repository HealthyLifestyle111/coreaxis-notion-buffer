const API = "https://api.buffer.com";
const KEY = process.env.BUFFER_API_KEY;

if (!KEY) {
  console.error("BUFFER_API_KEY is missing.");
  process.exit(1);
}

async function gql(query, variables = {}) {
  const response = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.errors?.length) {
    throw new Error(`Buffer diagnostic failed: ${JSON.stringify(body)}`);
  }
  return body.data;
}

const account = await gql(`query DiagnosticOrganizations {
  account {
    organizations {
      id
      name
    }
  }
}`);

const organizations = account?.account?.organizations || [];
console.log("ORGANIZATION_COUNT", organizations.length);

for (const organization of organizations) {
  const result = await gql(`query DiagnosticChannels($organizationId: OrganizationId!) {
    channels(input: { organizationId: $organizationId }) {
      id
      name
      displayName
      service
      isDisconnected
      isLocked
    }
  }`, { organizationId: organization.id });

  console.log("ORGANIZATION", JSON.stringify(organization));
  console.log("CHANNELS", JSON.stringify(result?.channels || []));
}
