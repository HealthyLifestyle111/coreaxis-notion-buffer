import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLane, resolveCampaignLane, assertLaneOwnership } from './campaign-lanes.js';

test('normalizes campaign lanes safely', () => {
  assert.equal(normalizeLane(' Menopause Core '), 'menopause-core');
  assert.equal(normalizeLane('EllieMD'), 'elliemd');
});

test('resolves isolated storage and namespace', () => {
  const lane = resolveCampaignLane({ id: 'august-launch', lane: 'EllieMD' });
  assert.equal(lane.lane, 'elliemd');
  assert.equal(lane.storageDir, '.coreaxis/lanes/elliemd');
  assert.equal(lane.namespace, 'elliemd:august-launch');
});

test('rejects cross-lane ownership', () => {
  assert.throws(
    () => assertLaneOwnership({ lane: 'menopause-core' }, 'elliemd'),
    /Campaign lane mismatch/
  );
});
