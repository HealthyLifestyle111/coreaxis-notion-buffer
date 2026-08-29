const env = (name) => Boolean(process.env[name]?.trim());

export const integrations = [
  { id: 'hosting', label: 'Live hosting', required: ['RENDER_EXTERNAL_URL'], action: 'Create the Render service from render.yaml.' },
  { id: 'admin', label: 'Approval Studio login', required: ['COREAXIS_ADMIN_USER', 'COREAXIS_ADMIN_PASSWORD'], action: 'Set the generated admin username and password in the hosting environment.' },
  { id: 'notion', label: 'Notion campaign source', required: ['NOTION_TOKEN'], action: 'Add the Notion integration token.' },
  { id: 'buffer', label: 'Buffer publishing', required: ['BUFFER_API_KEY'], action: 'Add the Buffer API key.' },
  { id: 'meta', label: 'Instagram and Facebook', required: ['META_ACCESS_TOKEN', 'META_PAGE_ID', 'META_IG_USER_ID'], action: 'Authorize the Meta app and add Page and Instagram account IDs.' },
  { id: 'youtube', label: 'YouTube Shorts', required: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'], action: 'Authorize YouTube upload access and add the author credentials.' },
  { id: 'linkedin', label: 'LinkedIn', required: ['LINKEDIN_ACCESS_TOKEN', 'LINKEDIN_AUTHOR_URN'], action: 'Authorize LinkedIn publishing and add the author URN.' },
  { id: 'render-hook', label: 'Automatic redeployment', required: ['RENDER_DEPLOY_HOOK_URL'], action: 'Create a Render deploy hook and save it as a GitHub secret.' },
  { id: 'video', label: 'AI video rendering', alternatives: [['VIDEO_RENDER_WEBHOOK_URL'], ['RUNWAY_API_KEY'], ['KLING_API_KEY'], ['VEO_API_KEY']], action: 'Connect the configured production video renderer.' },
  { id: 'wix', label: 'Wix website synchronization', alternatives: [['WIX_API_KEY', 'WIX_SITE_ID'], ['WIX_ACCOUNT_ID', 'WIX_SITE_ID']], action: 'Authorize Wix site access and provide the site ID.' },
];

export function integrationStatus() {
  return integrations.map((integration) => {
    const requiredReady = integration.required?.every(env) ?? false;
    const alternativeReady = integration.alternatives?.some((group) => group.every(env)) ?? false;
    const connected = requiredReady || alternativeReady;
    const missing = integration.required
      ? integration.required.filter((name) => !env(name))
      : integration.alternatives?.flat().filter((name) => !env(name)) || [];
    return { ...integration, connected, missing };
  });
}

export function productionReadiness() {
  const status = integrationStatus();
  const coreIds = new Set(['hosting', 'admin', 'notion', 'buffer']);
  const core = status.filter((item) => coreIds.has(item.id));
  const connected = status.filter((item) => item.connected);
  const blocked = status.filter((item) => !item.connected);
  return {
    readyForCoreOperation: core.every((item) => item.connected),
    connectedCount: connected.length,
    totalCount: status.length,
    connected,
    blocked,
    generatedAt: new Date().toISOString(),
  };
}
