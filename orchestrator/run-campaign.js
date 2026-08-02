#!/usr/bin/env node
import fs from 'node:fs/promises';
import { CoreAxisOrchestrator } from './coreaxis-orchestrator.js';

const briefPath = process.argv[2];
if (!briefPath) {
  console.error('Usage: node orchestrator/run-campaign.js <campaign-brief.json>');
  process.exit(1);
}

try {
  const brief = JSON.parse(await fs.readFile(briefPath, 'utf8'));
  const orchestrator = new CoreAxisOrchestrator();
  const campaign = await orchestrator.execute(brief);
  console.log(JSON.stringify({
    campaignId: campaign.id,
    status: campaign.status,
    qaScore: campaign.qa?.score,
    approvalRequired: campaign.approval.status !== 'approved',
    outputFile: `.coreaxis/campaigns/${campaign.id}.json`,
  }, null, 2));
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
