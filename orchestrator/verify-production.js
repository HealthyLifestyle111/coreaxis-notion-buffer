import fs from 'node:fs/promises';
import path from 'node:path';
import { productionReadiness } from './integration-registry.js';
import { route } from '../gateway/router.js';

const requiredFiles = [
  'Dockerfile',
  'render.yaml',
  'studio/server.js',
  'studio/public/index.html',
  'orchestrator/coreaxis-orchestrator.js',
  'orchestrator/config/coreaxis-brand-memory.json',
  '.github/workflows/coreaxis-deployment-ci.yml',
  '.github/workflows/deploy-coreaxis-studio.yml',
];

const root = path.resolve(new URL('..', import.meta.url).pathname);
const fileChecks = await Promise.all(requiredFiles.map(async (file) => {
  try {
    await fs.access(path.join(root, file));
    return { file, present: true };
  } catch {
    return { file, present: false };
  }
}));

const smokeCases = [
  ['peptide', { known_intent: 'peptide' }, 'DIRECT_PEPTIDE'],
  ['cellcore', { known_intent: 'cellcore' }, 'CELLULAR_CLEANSE'],
  ['women', { primary_area: 'women', life_stage: 'whole_woman' }, 'POMEGRANATE'],
  ['midlife', { primary_area: 'midlife', life_stage: 'perimenopause_menopause' }, 'MENOPAUSE_CORE'],
  ['fertility', { primary_area: 'fertility', life_stage: 'fertility_preconception' }, 'OVO'],
  ['men', { primary_area: 'men', life_stage: 'male_vitality' }, 'OYSTER'],
  ['pet', { scope: 'pet' }, 'VIBRANT_PETS'],
  ['household', { scope: 'household' }, 'HEALTHIER_TOGETHER'],
  ['unknown', { known_intent: 'not_sure', primary_area: 'unsure' }, 'FOUNDATION_EXPERIENCE'],
];

const routingChecks = smokeCases.map(([name, answers, expected]) => {
  const result = route(answers, { source: 'production-smoke-test', campaign: 'launch-verification' });
  return { name, expected, actual: result.destination, passed: result.destination === expected };
});

const readiness = productionReadiness();
const report = {
  applicationComplete: fileChecks.every((item) => item.present),
  fileChecks,
  routingChecks,
  routingComplete: routingChecks.every((item) => item.passed),
  ...readiness,
};

console.log(JSON.stringify(report, null, 2));

if (!report.applicationComplete || !report.routingComplete) process.exitCode = 1;
