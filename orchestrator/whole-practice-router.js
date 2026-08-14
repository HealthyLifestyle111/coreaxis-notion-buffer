import routing from './config/whole-practice-routing.json' with { type: 'json' };

export function routeKnownIntent(intent) {
  const value = String(intent ?? '').trim().toLowerCase();
  if (['cellcore', 'jumpstart', 'cellcore_products'].includes(value)) return routing.direct_routes.DIRECT_CELLCORE;
  if (value === 'peptides') return routing.direct_routes.DIRECT_PEPTIDE;
  if (value === 'named_program') return routing.direct_routes.DIRECT_PROGRAM;
  return null;
}

export function routeDiscovery({ goal, womenGoal, menGoal, foundationChoice } = {}) {
  const g = String(goal ?? '').trim().toLowerCase();
  if (g === 'fertility') return routing.destinations.OVO;
  if (g === 'menopause') return routing.destinations.MENOPAUSE_CORE;
  if (g === 'pet') return routing.destinations.VIBRANT_PETS;
  if (g === 'household') return routing.destinations.HEALTHIER_TOGETHER;
  if (g === 'men') {
    if (menGoal === 'fertility_family_building') return routing.destinations.OVO;
    if (menGoal === 'vitality_performance_recovery_longevity') return routing.destinations.OYSTER;
    return { route: 'concierge_review' };
  }
  if (g === 'women') {
    if (womenGoal === 'fertility_preparation') return routing.destinations.OVO;
    if (womenGoal === 'perimenopause_menopause') return routing.destinations.MENOPAUSE_CORE;
    if (['whole_woman', 'cycle_reproductive_wellness'].includes(womenGoal)) return routing.destinations.POMEGRANATE;
    return { route: 'concierge_review' };
  }
  if (g === 'overall_foundation') {
    if (foundationChoice === 'practitioner_foundation') return routing.destinations.CELLULAR_CLEANSE;
    if (foundationChoice === 'direct_cellcore') return routing.direct_routes.DIRECT_CELLCORE;
    return { route: 'concierge_review' };
  }
  return { route: 'concierge_review' };
}

export function intakeFor(route) {
  return route?.intake ?? null;
}
