import test from 'node:test';
import assert from 'node:assert/strict';
import { routeKnownIntent, routeDiscovery, intakeFor } from './whole-practice-router.js';

test('direct CellCore bypasses Whole Practice intake', () => {
  const route = routeKnownIntent('jumpstart');
  assert.equal(route.whole_practice_intake, false);
  assert.equal(route.action, 'send_to_established_cellcore_patient_access_route');
});

test('peptide intent uses direct route', () => {
  const route = routeKnownIntent('peptides');
  assert.equal(route.whole_practice_intake, false);
});

test('women fertility routes to OVO', () => {
  const route = routeDiscovery({ goal: 'women', womenGoal: 'fertility_preparation' });
  assert.equal(route.title, 'OVO — Fertility & Preparation Pathway');
});

test('women menopause routes to Menopause Core', () => {
  const route = routeDiscovery({ goal: 'women', womenGoal: 'perimenopause_menopause' });
  assert.equal(route.title, 'Menopause Core');
});

test('general women wellness routes to Pomegranate', () => {
  const route = routeDiscovery({ goal: 'women', womenGoal: 'whole_woman' });
  assert.equal(route.title, 'Pomegranate — Whole-Woman Foundations');
});

test('men vitality routes to Oyster', () => {
  const route = routeDiscovery({ goal: 'men', menGoal: 'vitality_performance_recovery_longevity' });
  assert.equal(route.title, "Oyster — Men's Vitality");
});

test('pet routes to Vibrant Pets', () => {
  const route = routeDiscovery({ goal: 'pet' });
  assert.equal(route.title, 'Vibrant Pets');
});

test('household routes to Healthier Together', () => {
  const route = routeDiscovery({ goal: 'household' });
  assert.equal(route.title, 'Healthier Together — Household Wellness');
});

test('practitioner foundation routes to complimentary Cellular Cleanse', () => {
  const route = routeDiscovery({ goal: 'overall_foundation', foundationChoice: 'practitioner_foundation' });
  assert.equal(route.title, 'Cellular Cleanse');
  assert.equal(route.price, 0);
  assert.equal(route.price_status, 'complimentary');
});

test('ambiguous cases go to concierge review instead of guessing', () => {
  const route = routeDiscovery({ goal: 'something_specific' });
  assert.equal(route.route, 'concierge_review');
});

test('each destination maps to an intake', () => {
  const route = routeDiscovery({ goal: 'menopause' });
  assert.equal(intakeFor(route), 'menopause_core_intake');
});
