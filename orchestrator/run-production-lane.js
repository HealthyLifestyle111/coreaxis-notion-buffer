#!/usr/bin/env node
import fs from 'node:fs/promises';
import { EndToEndProductionLane } from './production-lane.js';
import { buildAdaptersFromEnvironment } from './adapters.js';

const command = process.argv[2];
const value = process.argv[3];
const lane = new EndToEndProductionLane({ adapters: buildAdaptersFromEnvironment() });

try {
  let result;
  if (command === 'start') {
    if (!value) throw new Error('Usage: npm run production:lane -- start <brief.json>');
    result = await lane.start(JSON.parse(await fs.readFile(value, 'utf8')));
  } else if (command === 'resume') {
    result = await lane.resume(value);
  } else if (command === 'approve-queue') {
    result = await lane.approveAndQueue(value, { approvedBy: process.env.COREAXIS_APPROVER || 'CoreAxis Admin' });
  } else if (command === 'publish') {
    result = await lane.publish(value);
  } else {
    throw new Error('Commands: start <brief.json> | resume <campaignId> | approve-queue <campaignId> | publish <campaignId>');
  }
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
