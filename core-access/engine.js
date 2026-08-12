const ROUTES = require('./routes.json').routes;

function result(route, reason) {
  const r = ROUTES[route];
  return { route, label: r.label, reason, action: r.action, direct: r.direct, requires_whole_practice: r.whole_practice };
}

/**
 * Progressive elimination engine.
 * Only routing metadata is accepted; substantive health answers belong in Whole Practice.
 */
function route(input = {}) {
  const { scope = 'unknown', intent = 'unknown', specificity = 'unsure', life_stage = 'unknown' } = input;

  if (intent === 'peptide') return result('peptide_direct', 'You already know you want peptide access, so you can go directly to the approved destination.');
  if (intent === 'cellcore' && specificity === 'exact') return result('cellcore_direct', 'You already know you want the direct CellCore route, so no additional CoreAxis intake is necessary.');

  if (scope === 'pet' || intent === 'pet') return result('vibrant_pets', 'Your starting point is the companion-animal wellness pathway.');
  if (scope === 'household' || intent === 'household') return result('healthier_together', 'Your starting point is the coordinated household pathway, with each person and pet routed individually.');

  if (intent === 'fertility' || life_stage === 'fertility') return result('ovo', 'Your starting point is the fertility and preconception pathway.');
  if (intent === 'menopause' || ['perimenopause','menopause','postmenopause'].includes(life_stage)) return result('menopause_core', 'Your starting point is the dedicated midlife pathway.');
  if (intent === 'mens' || (scope === 'self' && intent === 'mens')) return result('oyster', 'Your starting point is the men’s vitality pathway.');
  if (intent === 'womens') return result('pomegranate', 'Your starting point is the whole-woman pathway.');
  if (intent === 'foundational') return result('cellular_cleanse', 'Your starting point is the foundational cellular-support pathway.');

  return result('concierge_review', 'There are multiple possible starting points, so concierge review should determine the first door rather than making you choose.');
}

module.exports = { route };
