import test from 'node:test';
import assert from 'node:assert/strict';
import { route } from './router.js';

const cases = [
  [{ known_intent: 'peptide' }, 'DIRECT_PEPTIDE', true],
  [{ known_intent: 'cellcore' }, 'CELLULAR_CLEANSE', false],
  [{ primary_area: 'women', life_stage: 'whole_woman', scope: 'me' }, 'POMEGRANATE', false],
  [{ primary_area: 'midlife', life_stage: 'perimenopause_menopause', scope: 'me' }, 'MENOPAUSE_CORE', false],
  [{ primary_area: 'fertility', life_stage: 'fertility_preconception', scope: 'partner_fertility' }, 'OVO', false],
  [{ primary_area: 'men', life_stage: 'male_vitality', scope: 'me' }, 'OYSTER', false],
  [{ primary_area: 'pet', life_stage: 'pet_wellness', scope: 'pet' }, 'VIBRANT_PETS', false],
  [{ primary_area: 'household', life_stage: 'household_wellness', scope: 'household' }, 'HEALTHIER_TOGETHER', false],
  [{ primary_area: 'foundational', life_stage: 'foundational', scope: 'me' }, 'CELLULAR_CLEANSE', false],
  [{}, 'FOUNDATION_EXPERIENCE', false]
];

for (const [answers, destination, direct] of cases) {
  test(`launch route → ${destination}`, () => {
    const result = route(answers, {
      source: 'launch-qa', campaign: 'monday-launch', utm_source: 'test', utm_medium: 'qa', utm_campaign: 'monday-launch', utm_content: destination
    });
    assert.equal(result.destination, destination);
    assert.equal(result.direct, direct);
    assert.equal(result.attribution.campaign, 'monday-launch');
    assert.ok(result.fulfillment);
  });
}

test('CellCore never bypasses Whole Practice', () => {
  const result = route({ known_intent: 'cellcore' }, {});
  assert.equal(result.destination, 'CELLULAR_CLEANSE');
  assert.equal(result.fulfillment.type, 'whole_practice_then_fullscript');
  assert.equal(result.direct, false);
});

test('health answers are not included in attribution payload', () => {
  const result = route({ primary_area: 'women', symptoms: ['fatigue'], diagnosis: 'redacted' }, { source: 'social' });
  assert.equal(result.attribution.symptoms, undefined);
  assert.equal(result.attribution.diagnosis, undefined);
});
