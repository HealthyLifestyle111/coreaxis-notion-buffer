import test from 'node:test';
import assert from 'node:assert/strict';
import { WebsiteContentEngine, AnalyticsNormalizer, PublishingRouter } from '../orchestrator/platform-services.js';

const campaign = {
  id: 'cmp_test',
  brief: { name: 'Menopause Core Launch', offer: 'Menopause Core', objective: 'Guide qualified women into the right pathway.' },
  approval: { status: 'approved' },
  outputs: {
    strategy: { contentPillars: ['education', 'credibility'], platforms: ['instagram'] },
    creative: {
      hooks: ['The first step most women miss'],
      ctas: ['Explore the full program'],
      captions: ['A personalized Second Spring pathway.'],
      reelConcepts: [{ id: 'reel_1', title: 'Reel 1', hook: 'Hook', scenes: [], thumbnail: { headline: 'Start here' } }],
      seo: { title: 'Menopause Core', description: 'Personalized menopause wellness.' },
    },
  },
  publishing: { jobs: [{ platform: 'instagram', status: 'queued' }] },
};

test('website engine creates synchronized campaign content', () => {
  const output = new WebsiteContentEngine().generate(campaign);
  assert.equal(output.landingPage.slug, 'menopause-core-launch');
  assert.equal(output.landingPage.hero.cta, 'Explore the full program');
  assert.equal(output.videoGallery.length, 1);
});

test('analytics normalizer calculates campaign performance', () => {
  const service = new AnalyticsNormalizer();
  const row = service.normalize('instagram', { views: 1000, clicks: 100, leads: 10, spend: 50, revenue: 200 });
  assert.equal(row.costPerLead, 5);
  assert.equal(row.conversionRate, 0.1);
  assert.equal(row.clickThroughRate, 0.1);
  assert.equal(service.aggregate([row]).returnOnAdSpend, 4);
});

test('publishing router enforces approval and routes configured platforms', async () => {
  const router = new PublishingRouter({ instagram: { publish: async () => ({ externalId: 'ig_123' }) } });
  const [result] = await router.dispatchQueue(campaign);
  assert.equal(result.status, 'published');
  assert.equal(result.externalId, 'ig_123');

  await assert.rejects(() => router.dispatch({ platform: 'instagram' }, { ...campaign, approval: { status: 'pending' } }), /approval/i);
});
