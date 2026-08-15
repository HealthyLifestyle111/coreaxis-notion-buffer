import test from 'node:test';
import assert from 'node:assert/strict';
import { route } from './router.js';

test('peptide stays direct', () => {
  const r = route({known_intent:'peptide'}, {clinic_id:'CLINIC-01'});
  assert.equal(r.destination, 'DIRECT_PEPTIDE');
  assert.equal(r.direct, true);
});

test('CellCore enters Whole Practice first', () => {
  const r = route({known_intent:'cellcore', investment_readiness:'guided_program'});
  assert.equal(r.destination, 'CELLULAR_CLEANSE');
  assert.equal(r.fulfillment.type, 'whole_practice_then_fullscript');
});

test('fertility routes to OVO', () => {
  const r = route({primary_area:'fertility', investment_readiness:'guided_program'});
  assert.equal(r.destination, 'OVO');
});

test('menopause routes to Menopause Core', () => {
  const r = route({primary_area:'midlife', life_stage:'perimenopause_menopause', investment_readiness:'entry_level_program'});
  assert.equal(r.destination, 'MENOPAUSE_CORE');
});

test('pet routes to Vibrant Pets', () => {
  const r = route({scope:'pet', investment_readiness:'guided_program'});
  assert.equal(r.destination, 'VIBRANT_PETS');
});

test('household routes to Healthier Together', () => {
  const r = route({scope:'household', investment_readiness:'guided_program'});
  assert.equal(r.destination, 'HEALTHIER_TOGETHER');
});

test('investment readiness changes access level, not need', () => {
  const r = route({primary_area:'women', life_stage:'whole_woman', investment_readiness:'resources_only'});
  assert.equal(r.destination, 'POMEGRANATE');
  assert.equal(r.access, 'SELF_DIRECTED');
});

test('partner attribution survives routing', () => {
  const r = route({primary_area:'men'}, {source:'clinic', campaign:'gateway', partner_id:'P-7', clinic_id:'C-7'});
  assert.equal(r.destination, 'OYSTER');
  assert.equal(r.attribution.partner_id, 'P-7');
  assert.equal(r.attribution.clinic_id, 'C-7');
});
