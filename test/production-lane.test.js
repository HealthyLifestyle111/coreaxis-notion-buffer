import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { EndToEndProductionLane } from '../orchestrator/production-lane.js';

const tempStorage = () => fs.mkdtemp(path.join(os.tmpdir(), 'coreaxis-lane-'));
const brief = {
  name: 'Menopause Core Production Lane',
  objective: 'Create an approval-ready campaign and synchronized website package.',
  audience: 'women navigating perimenopause, menopause, and post-menopause',
  offer: 'Menopause Core',
  platforms: ['instagram', 'linkedin'],
};

test('production lane creates campaign, website package, QA, and checkpoints', async () => {
  const storageDir = await tempStorage();
  const lane = new EndToEndProductionLane({ storageDir });
  const campaign = await lane.start(brief, { renderVideos: false });
  assert.equal(campaign.status, 'awaiting_approval');
  assert.ok(campaign.outputs.website.landingPage);
  assert.ok(campaign.history.some((entry) => entry.event === 'website_package_generated'));
  await fs.access(path.join(storageDir, 'website', `${campaign.id}.json`));
});

test('production lane resumes an interrupted campaign without duplicate work', async () => {
  const storageDir = await tempStorage();
  const lane = new EndToEndProductionLane({ storageDir });
  const campaign = await lane.start(brief, { renderVideos: false });
  delete campaign.outputs.website;
  await lane.orchestrator.checkpoint(campaign, 'simulated_interruption');
  const resumed = await lane.resume(campaign.id, { renderVideos: false });
  assert.ok(resumed.outputs.website);
  assert.equal(resumed.history.filter((entry) => entry.event === 'strategy_generated').length, 1);
});

test('approval, queue, publishing, analytics, and learning form one lane', async () => {
  const storageDir = await tempStorage();
  const publishers = {
    instagram: { publish: async () => ({ status: 'published', externalId: 'ig-1' }) },
    linkedin: { publish: async () => ({ status: 'published', externalId: 'li-1' }) },
  };
  const lane = new EndToEndProductionLane({ storageDir, adapters: { publishers } });
  const campaign = await lane.start(brief, { renderVideos: false });
  const queued = await lane.approveAndQueue(campaign.id, { approvedBy: 'Jenna' });
  assert.equal(queued.status, 'queued');
  const published = await lane.publish(campaign.id);
  assert.equal(published.status, 'published');
  const result = await lane.ingestAnalytics(campaign.id, 'instagram', {
    assetId: 'ig-1', views: 1000, clicks: 100, leads: 10, spend: 50, revenue: 200,
    hook: 'Hook A', visual: 'Visual A', cta: 'CTA A', completionRate: 0.7,
  });
  assert.equal(result.analytics.totals.costPerLead, 5);
  assert.equal(result.analytics.totals.returnOnAdSpend, 4);
  assert.deepEqual(result.learning.bestHooks, ['Hook A']);
});
