#!/usr/bin/env node
import fs from 'node:fs/promises';
import { CoreAxisOrchestrator } from './coreaxis-orchestrator.js';
import { resolveCampaignLane } from './campaign-lanes.js';

const manifestPath = process.argv[2];
if (!manifestPath) {
  console.error('Usage: node orchestrator/run-campaign-batch.js <campaign-manifest.json>');
  process.exit(1);
}

async function runOne(entry) {
  const brief = typeof entry === 'string'
    ? JSON.parse(await fs.readFile(entry, 'utf8'))
    : entry;
  const lane = resolveCampaignLane(brief);
  const orchestrator = new CoreAxisOrchestrator({ storageDir: lane.storageDir });
  const campaign = await orchestrator.execute({ ...brief, lane: lane.lane });
  campaign.lane = lane.lane;
  campaign.namespace = lane.namespace;
  await orchestrator.checkpoint(campaign, 'lane_assigned');
  return {
    campaignId: campaign.id,
    lane: lane.lane,
    namespace: lane.namespace,
    status: campaign.status,
    qaScore: campaign.qa?.score,
    outputFile: `${lane.storageDir}/campaigns/${campaign.id}.json`,
  };
}

try {
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const campaigns = Array.isArray(manifest) ? manifest : manifest.campaigns;
  if (!Array.isArray(campaigns) || campaigns.length === 0) {
    throw new Error('Campaign manifest must contain a non-empty campaigns array.');
  }

  const results = await Promise.allSettled(campaigns.map(runOne));
  const summary = results.map((result, index) => result.status === 'fulfilled'
    ? result.value
    : { index, status: 'blocked', error: result.reason?.message || String(result.reason) });

  console.log(JSON.stringify({
    total: summary.length,
    completed: summary.filter((x) => x.status !== 'blocked').length,
    blocked: summary.filter((x) => x.status === 'blocked').length,
    campaigns: summary,
  }, null, 2));

  if (summary.some((x) => x.status === 'blocked')) process.exitCode = 1;
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
