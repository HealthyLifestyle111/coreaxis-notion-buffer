import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CoreAxisOrchestrator } from '../orchestrator/coreaxis-orchestrator.js';

async function tempStorage() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'coreaxis-'));
}

const brief = {
  name: 'Menopause Core Launch',
  objective: 'Educate qualified women and move them into the correct CoreAxis pathway',
  audience: 'women navigating perimenopause, menopause, and post-menopause',
  offer: 'Menopause Core',
  platforms: ['instagram', 'linkedin'],
};

test('one brief generates a complete approval-ready campaign package', async () => {
  const orchestrator = new CoreAxisOrchestrator({ storageDir: await tempStorage() });
  const campaign = await orchestrator.execute(brief, { renderVideos: false });

  assert.equal(campaign.status, 'awaiting_approval');
  assert.equal(campaign.outputs.creative.reelConcepts.length, 8);
  assert.ok(campaign.outputs.creative.hooks.length >= 10);
  assert.ok(campaign.outputs.creative.ctas.length >= 5);
  assert.equal(campaign.qa.passed, true);
  assert.equal(campaign.publishing.status, 'blocked_until_approved');
});

test('publishing is impossible before explicit approval', async () => {
  const publisher = { publish: async () => ({ status: 'published' }) };
  const orchestrator = new CoreAxisOrchestrator({ storageDir: await tempStorage(), adapters: { publisher } });
  const campaign = await orchestrator.execute(brief, { renderVideos: false });

  await assert.rejects(() => orchestrator.publish(campaign.id), /not approved/i);
});

test('approved campaigns publish once per selected platform', async () => {
  const calls = [];
  const publisher = {
    publish: async ({ platform }) => {
      calls.push(platform);
      return { status: 'published', externalId: `${platform}-123` };
    },
  };
  const orchestrator = new CoreAxisOrchestrator({ storageDir: await tempStorage(), adapters: { publisher } });
  const campaign = await orchestrator.execute(brief, { renderVideos: false });
  await orchestrator.approve(campaign.id, 'Jenna');
  const published = await orchestrator.publish(campaign.id);

  assert.deepEqual(calls, ['instagram', 'linkedin']);
  assert.equal(published.status, 'published');
  assert.equal(published.publishing.jobs.length, 2);
});
