#!/usr/bin/env node
import fs from 'node:fs/promises';
import { CoreAxisOrchestrator } from './coreaxis-orchestrator.js';
import { resolveCampaignLane } from './campaign-lanes.js';

const briefPath = process.argv[2];
if (!briefPath) {
  console.error('Usage: node orchestrator/run-campaign-lane.js <campaign-brief.json>');
  process.exit(1);
}

try {
  const brief = JSON.parse(await fs.readFile(briefPath, 'utf8'));
  const lane = resolveCampaignLane(brief);
  const orchestrator = new CoreAxisOrchestrator({ storageDir: lane.storageDir });
  const campaign = await orchestrator.execute({ ...brief, lane: lane.lane });
  campaign.lane = lane.lane;
  campaign.namespace = lane.namespace;
  await orchestrator.checkpoint(campaign, 'lane_assigned');

  console.log(JSON.stringify({
    campaignId: campaign.id,
    lane: lane.lane,
    namespace: lane.namespace,
    status: campaign.status,
    qaScore: campaign.qa?.score,
    approvalRequired: campaign.approval.status !== 'approved',
    outputFile: `${lane.storageDir}/campaigns/${campaign.id}.json`,
  }, null, 2));
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
