import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CoreAxisOrchestrator } from '../orchestrator/coreaxis-orchestrator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const storageDir = path.resolve(process.env.COREAXIS_STORAGE_DIR || path.join(root, '.coreaxis'));
const orchestrator = new CoreAxisOrchestrator({ storageDir });
const port = Number(process.env.PORT || 4173);

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};

const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

const listCampaigns = async () => {
  const dir = path.join(storageDir, 'campaigns');
  await fs.mkdir(dir, { recursive: true });
  const files = (await fs.readdir(dir)).filter((name) => name.endsWith('.json'));
  const campaigns = await Promise.all(files.map(async (name) => JSON.parse(await fs.readFile(path.join(dir, name), 'utf8'))));
  return campaigns.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
};

const saveCampaign = async (campaign, event) => {
  campaign.version = Number(campaign.version || 1) + 1;
  campaign.updatedAt = new Date().toISOString();
  campaign.history ||= [];
  campaign.history.push({ event, at: campaign.updatedAt, version: campaign.version });
  await fs.writeFile(path.join(storageDir, 'campaigns', `${campaign.id}.json`), JSON.stringify(campaign, null, 2));
  await fs.mkdir(path.join(storageDir, 'logs'), { recursive: true });
  await fs.appendFile(path.join(storageDir, 'logs', 'actions.ndjson'), `${JSON.stringify({ campaignId: campaign.id, event, at: campaign.updatedAt, version: campaign.version })}\n`);
  return campaign;
};

const serveStatic = async (req, res) => {
  const map = { '/': 'index.html', '/app.js': 'app.js', '/styles.css': 'styles.css' };
  const file = map[req.url];
  if (!file) return false;
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
  const content = await fs.readFile(path.join(__dirname, 'public', file));
  res.writeHead(200, { 'content-type': `${types[path.extname(file)]}; charset=utf-8` });
  res.end(content);
  return true;
};

const server = http.createServer(async (req, res) => {
  try {
    if (await serveStatic(req, res)) return;
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, { ok: true, service: 'coreaxis-approval-studio' });
    if (req.method === 'GET' && url.pathname === '/api/campaigns') return json(res, 200, await listCampaigns());

    const match = url.pathname.match(/^\/api\/campaigns\/([^/]+)(?:\/(approve|reject|revise|queue))?$/);
    if (match) {
      const [, campaignId, action] = match;
      const campaign = await orchestrator.loadCampaign(campaignId);
      if (req.method === 'GET' && !action) return json(res, 200, campaign);
      if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
      const body = await readBody(req);

      if (action === 'approve') {
        if (!campaign.qa?.passed) return json(res, 409, { error: 'QA must pass before approval.' });
        campaign.approval = { status: 'approved', approvedAt: new Date().toISOString(), approvedBy: body.approvedBy || 'CoreAxis Admin' };
        campaign.status = 'approved';
        campaign.publishing = { ...(campaign.publishing || {}), status: 'ready' };
        return json(res, 200, await saveCampaign(campaign, 'campaign_approved_in_studio'));
      }

      if (action === 'reject') {
        campaign.approval = { status: 'rejected', rejectedAt: new Date().toISOString(), reason: body.reason || 'Rejected in Approval Studio' };
        campaign.status = 'rejected';
        campaign.publishing = { ...(campaign.publishing || {}), status: 'blocked' };
        return json(res, 200, await saveCampaign(campaign, 'campaign_rejected_in_studio'));
      }

      if (action === 'revise') {
        campaign.approval = { status: 'revision_requested', requestedAt: new Date().toISOString(), notes: body.notes || '' };
        campaign.status = 'revision_required';
        campaign.revisions ||= [];
        campaign.revisions.push({ id: crypto.randomUUID(), requestedAt: new Date().toISOString(), notes: body.notes || '', status: 'open' });
        return json(res, 200, await saveCampaign(campaign, 'campaign_revision_requested'));
      }

      if (action === 'queue') {
        if (campaign.approval?.status !== 'approved') return json(res, 409, { error: 'Only approved campaigns can enter the publish queue.' });
        campaign.publishing ||= { jobs: [] };
        campaign.publishing.status = 'queued';
        campaign.publishing.queuedAt = new Date().toISOString();
        campaign.publishing.jobs = (campaign.outputs?.strategy?.platforms || []).map((platform) => ({ platform, status: 'queued', scheduledFor: body.scheduledFor || null }));
        campaign.status = 'queued';
        return json(res, 200, await saveCampaign(campaign, 'campaign_queued_for_publishing'));
      }
    }

    json(res, 404, { error: 'Not found' });
  } catch (error) {
    json(res, 500, { error: error.message });
  }
});

server.listen(port, async () => {
  await orchestrator.initialize();
  console.log(`CoreAxis Approval Studio running at http://localhost:${port}`);
});
