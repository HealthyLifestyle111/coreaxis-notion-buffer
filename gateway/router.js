import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const spec = JSON.parse(fs.readFileSync(path.join(__dirname, 'universal-gateway.json'), 'utf8'));

const route = (answers = {}, attribution = {}) => {
  const known = answers.known_intent;
  let destination = 'FOUNDATION_EXPERIENCE';
  let reason = 'No narrower route identified; use the foundational gateway.';
  let direct = false;

  if (known === 'peptide') {
    destination = 'DIRECT_PEPTIDE'; direct = true;
    reason = 'Explicit peptide intent preserves the locked direct peptide path.';
  } else if (known === 'cellcore') {
    destination = 'CELLULAR_CLEANSE';
    reason = 'Explicit CellCore intent enters Whole Practice foundation first; no direct CoreAxis bypass.';
  } else if (known === 'known_program') {
    destination = mapProgram(answers.primary_area, answers.life_stage, answers.scope);
    reason = 'Known-program intent is normalized to the approved CoreAxis destination.';
  } else {
    destination = mapProgram(answers.primary_area, answers.life_stage, answers.scope);
    reason = 'Concierge elimination selected the single best starting route.';
  }

  const investment = answers.investment_readiness;
  const access = investment === 'resources_only' || investment === 'not_ready' ? 'SELF_DIRECTED' :
    investment === 'entry_level_program' ? 'ENTRY_PROGRAM' :
    investment === 'guided_program' ? 'GUIDED_PROGRAM' :
    investment === 'higher_touch' ? 'HIGHER_TOUCH' : 'REVIEW_REQUIRED';

  const source = {
    source: attribution.source || 'unknown',
    campaign: attribution.campaign || 'unknown',
    partner_id: attribution.partner_id || null,
    clinic_id: attribution.clinic_id || null,
    utm_source: attribution.utm_source || null,
    utm_medium: attribution.utm_medium || null,
    utm_campaign: attribution.utm_campaign || null,
    utm_content: attribution.utm_content || null
  };

  return {
    version: spec.version,
    destination,
    direct,
    access,
    reason,
    attribution: source,
    fulfillment: fulfillmentFor(destination, access)
  };
};

function mapProgram(area, stage, scope) {
  if (scope === 'pet' || area === 'pet' || stage === 'pet_wellness') return 'VIBRANT_PETS';
  if (scope === 'household' || area === 'household' || stage === 'household_wellness') return 'HEALTHIER_TOGETHER';
  if (area === 'fertility' || scope === 'partner_fertility' || stage === 'fertility_preconception') return 'OVO';
  if (area === 'midlife' || stage === 'perimenopause_menopause') return 'MENOPAUSE_CORE';
  if (area === 'men' || stage === 'male_vitality') return 'OYSTER';
  if (area === 'women' || stage === 'whole_woman' || stage === 'cycle') return 'POMEGRANATE';
  if (area === 'foundational' || stage === 'foundational') return 'CELLULAR_CLEANSE';
  return 'FOUNDATION_EXPERIENCE';
}

function fulfillmentFor(destination, access) {
  if (destination === 'DIRECT_PEPTIDE') return { type: 'direct', env: 'ELLIE_MD_DIRECT_URL' };
  if (access === 'SELF_DIRECTED') return {
    type: 'self_directed_fallback',
    envs: ['FULLSCRIPT_SELF_DIRECTED_URL','DOTERRA_SELF_DIRECTED_URL','SHOP_COMING_SOON_URL']
  };
  if (destination === 'CELLULAR_CLEANSE') return {
    type: 'whole_practice_then_fullscript',
    env: 'FULLSCRIPT_CELLCORE_LINK'
  };
  return { type: 'whole_practice_package', env: spec.routes[destination]?.destination_env || 'WHOLE_PRACTICE_GATEWAY_URL' };
}

export { route };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const input = JSON.parse(process.argv[2] || '{}');
  console.log(JSON.stringify(route(input.answers, input.attribution), null, 2));
}
