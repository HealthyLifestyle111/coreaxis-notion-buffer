import path from 'node:path';

const DEFAULT_LANE = 'coreaxis-general';

export function normalizeLane(value = DEFAULT_LANE) {
  const lane = String(value || DEFAULT_LANE)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!lane) throw new Error('Campaign lane must contain at least one letter or number.');
  if (lane.length > 64) throw new Error('Campaign lane must be 64 characters or fewer.');
  return lane;
}

export function resolveCampaignLane(brief = {}) {
  const lane = normalizeLane(brief.lane || brief.program || brief.brand || DEFAULT_LANE);
  const campaignKey = String(brief.id || brief.name || 'campaign')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'campaign';

  return {
    lane,
    campaignKey,
    storageDir: path.join('.coreaxis', 'lanes', lane),
    namespace: `${lane}:${campaignKey}`,
  };
}

export function assertLaneOwnership(campaign, lane) {
  const expected = normalizeLane(lane);
  const actual = normalizeLane(campaign?.lane || campaign?.brief?.lane || campaign?.brief?.program || campaign?.brief?.brand);
  if (actual !== expected) {
    throw new Error(`Campaign lane mismatch: expected ${expected}, received ${actual}.`);
  }
  return true;
}
