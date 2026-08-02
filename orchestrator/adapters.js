const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const postJson = async (url, body, headers = {}) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${data.error || data.message || text}`);
  return data;
};

export class WebhookPublisherAdapter {
  constructor({ url, token = null, platform }) {
    this.url = url;
    this.token = token;
    this.platform = platform;
  }

  async publish({ job, campaign }) {
    const data = await postJson(this.url, {
      platform: this.platform || job.platform,
      campaignId: campaign.id,
      scheduledFor: job.scheduledFor,
      brief: campaign.brief,
      creative: campaign.outputs?.creative,
      videos: campaign.outputs?.videos || [],
      website: campaign.outputs?.website,
      approval: campaign.approval,
    }, this.token ? { authorization: `Bearer ${this.token}` } : {});
    return {
      status: data.status || 'published',
      externalId: data.externalId || data.id || null,
      publicUrl: data.publicUrl || data.url || null,
      response: data,
    };
  }
}

export class BufferPublisherAdapter {
  constructor({ apiKey = process.env.BUFFER_API_KEY, endpoint = process.env.BUFFER_PUBLISH_ENDPOINT }) {
    this.apiKey = apiKey;
    this.endpoint = endpoint;
  }

  async publish({ job, campaign }) {
    if (!this.endpoint) throw new Error('Missing BUFFER_PUBLISH_ENDPOINT.');
    if (!this.apiKey) throw new Error('Missing BUFFER_API_KEY.');
    const creative = campaign.outputs?.creative || {};
    const firstAsset = creative.reelConcepts?.[0] || {};
    const data = await postJson(this.endpoint, {
      platform: job.platform,
      scheduledFor: job.scheduledFor,
      text: creative.captions?.[0] || campaign.brief.objective,
      title: firstAsset.title || campaign.brief.name,
      media: campaign.outputs?.videos?.[0]?.assets || [],
      campaignId: campaign.id,
      utm: campaign.brief.utm || {},
    }, { authorization: `Bearer ${this.apiKey}` });
    return { status: data.status || 'published', externalId: data.id || data.externalId || null, publicUrl: data.url || null };
  }
}

export class VideoWebhookAdapter {
  constructor({ url = process.env.VIDEO_RENDER_WEBHOOK_URL, token = process.env.VIDEO_RENDER_WEBHOOK_TOKEN } = {}) {
    this.url = url;
    this.token = token;
  }

  async render(job) {
    if (!this.url) return { ...job, status: 'blocked', error: 'No video render webhook configured.', assets: [] };
    const data = await postJson(this.url, job, this.token ? { authorization: `Bearer ${this.token}` } : {});
    return {
      ...job,
      status: data.status || 'rendered',
      providerJobId: data.jobId || data.id || null,
      assets: data.assets || (data.url ? [{ url: data.url, aspectRatio: '9:16' }] : []),
      provider: data.provider || 'webhook',
    };
  }
}

export function buildAdaptersFromEnvironment() {
  const publishers = {};
  const webhookToken = process.env.PUBLISH_WEBHOOK_TOKEN || null;
  for (const platform of ['instagram', 'facebook', 'tiktok', 'linkedin', 'x', 'youtube_shorts', 'pinterest']) {
    const envName = `PUBLISH_${platform.toUpperCase()}_WEBHOOK_URL`;
    const url = process.env[envName];
    if (url) publishers[platform] = new WebhookPublisherAdapter({ url, token: webhookToken, platform });
  }

  if (process.env.BUFFER_PUBLISH_ENDPOINT && process.env.BUFFER_API_KEY) {
    for (const platform of ['x', 'linkedin', 'pinterest']) publishers[platform] ||= new BufferPublisherAdapter({});
  }

  return {
    video: new VideoWebhookAdapter(),
    publishers,
  };
}

export const verifyAdapterEnvironment = () => ({
  video: Boolean(process.env.VIDEO_RENDER_WEBHOOK_URL),
  buffer: Boolean(process.env.BUFFER_API_KEY && process.env.BUFFER_PUBLISH_ENDPOINT),
  publisherWebhooks: ['instagram', 'facebook', 'tiktok', 'linkedin', 'x', 'youtube_shorts', 'pinterest']
    .filter((platform) => Boolean(process.env[`PUBLISH_${platform.toUpperCase()}_WEBHOOK_URL`])),
});
