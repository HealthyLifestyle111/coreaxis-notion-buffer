import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EndToEndProductionLane } from '../orchestrator/production-lane.js';
import { buildAdaptersFromEnvironment, verifyAdapterEnvironment } from '../orchestrator/adapters.js';
import { productionReadiness } from '../orchestrator/integration-registry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const storageDir = path.resolve(process.env.COREAXIS_STORAGE_DIR || path.join(root, '.coreaxis'));
const lane = new EndToEndProductionLane({ storageDir, adapters: buildAdaptersFromEnvironment() });
const port = Number(process.env.PORT || 4173);
const adminUser = process.env.COREAXIS_ADMIN_USER || '';
const adminPassword = process.env.COREAXIS_ADMIN_PASSWORD || '';

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};
const secureEqual = (left, right) => crypto.timingSafeEqual(
  crypto.createHash('sha256').update(String(left)).digest(),
  crypto.createHash('sha256').update(String(right)).digest(),
);
const authorized = (req) => {
  if (!adminUser || !adminPassword) return true;
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) return false;
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const separator = decoded.indexOf(':');
  if (separator < 0) return false;
  return secureEqual(decoded.slice(0, separator), adminUser) && secureEqual(decoded.slice(separator + 1), adminPassword);
};
const requireAuth = (req, res) => {
  if (authorized(req)) return true;
  res.writeHead(401, { 'www-authenticate': 'Basic realm="CoreAxis Approval Studio"', 'content-type': 'text/plain; charset=utf-8' });
  res.end('Authentication required');
  return false;
};
const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
};
const listCampaigns = async () => {
  const dir = path.join(storageDir, 'campaigns');
  await fs.mkdir(dir, { recursive: true });
  const files = (await fs.readdir(dir)).filter((name) => name.endsWith('.json'));
  const campaigns = await Promise.all(files.map(async (name) => JSON.parse(await fs.readFile(path.join(dir, name), 'utf8'))));
  return campaigns.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
};
const serveStatic = async (req, res) => {
  const map = { '/': 'index.html', '/app.js': 'app.js', '/styles.css': 'styles.css' };
  const file = map[req.url];
  if (!file) return false;
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
  const content = await fs.readFile(path.join(__dirname, 'public', file));
  res.writeHead(200, { 'content-type': `${types[path.extname(file)]}; charset=utf-8`, 'cache-control': 'no-store' });
  res.end(content);
  return true;
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, { ok: true, service: 'coreaxis-approval-studio' });
    if (!requireAuth(req, res)) return;
    if (await serveStatic(req, res)) return;

    if (req.method === 'GET' && url.pathname === '/api/readiness') {
      return json(res, 200, { ...productionReadiness(), adapters: verifyAdapterEnvironment() });
    }
    if (req.method === 'GET' && url.pathname === '/api/campaigns') return json(res, 200, await listCampaigns());
    if (req.method === 'POST' && url.pathname === '/api/campaigns') {
      const brief = await readBody(req);
      return json(res, 201, await lane.start(brief, { renderVideos: brief.renderVideos !== false }));
    }

    const match = url.pathname.match(/^\/api\/campaigns\/([^/]+)(?:\/(resume|approve|reject|revise|queue|approve-queue|publish|analytics))?$/);
    if (!match) return json(res, 404, { error: 'Not found' });
    const [, campaignId, action] = match;
    if (req.method === 'GET' && !action) return json(res, 200, await lane.orchestrator.loadCampaign(campaignId));
    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
    const body = await readBody(req);

    if (action === 'resume') return json(res, 200, await lane.resume(campaignId, body));
    if (action === 'approve-queue') return json(res, 200, await lane.approveAndQueue(campaignId, body));
    if (action === 'publish') return json(res, 200, await lane.publish(campaignId));
    if (action === 'analytics') return json(res, 200, await lane.ingestAnalytics(campaignId, body.platform, body.rows || body.data || []));

    const campaign = await lane.orchestrator.loadCampaign(campaignId);
    if (action === 'approve') return json(res, 200, await lane.orchestrator.approve(campaignId, body.approvedBy || 'CoreAxis Admin'));
    if (action === 'reject') {
      campaign.approval = { status: 'rejected', rejectedAt: new Date().toISOString(), reason: body.reason || 'Rejected in Approval Studio' };
      campaign.status = 'rejected';
      campaign.publishing = { ...(campaign.publishing || {}), status: 'blocked' };
      await lane.orchestrator.checkpoint(campaign, 'campaign_rejected_in_studio');
      return json(res, 200, campaign);
    }
    if (action === 'revise') {
      campaign.approval = { status: 'revision_requested', requestedAt: new Date().toISOString(), notes: body.notes || '' };
      campaign.status = 'revision_required';
      campaign.revisions ||= [];
      campaign.revisions.push({ id: crypto.randomUUID(), requestedAt: new Date().toISOString(), notes: body.notes || '', status: 'open' });
      await lane.orchestrator.checkpoint(campaign, 'campaign_revision_requested');
      return json(res, 200, campaign);
    }
    if (action === 'queue') {
      if (campaign.approval?.status !== 'approved') return json(res, 409, { error: 'Only approved campaigns can enter the publish queue.' });
      campaign.publishing ||= { jobs: [] };
      campaign.publishing.status = 'queued';
      campaign.publishing.queuedAt = new Date().toISOString();
      campaign.publishing.jobs = (campaign.outputs?.strategy?.platforms || []).map((platform) => ({ platform, status: 'queued', scheduledFor: body.scheduledFor || null }));
      campaign.status = 'queued';
      await lane.orchestrator.checkpoint(campaign, 'campaign_queued_for_publishing');
      return json(res, 200, campaign);
    }

    return json(res, 404, { error: 'Unknown action' });
  } catch (error) {
    json(res, 500, { error: error.message });
  }
});

server.listen(port, '0.0.0.0', async () => {
  await lane.initialize();
  console.log(`CoreAxis Approval Studio running on port ${port}`);
});
