import fs from 'node:fs/promises';
import path from 'node:path';
import { productionReadiness } from './integration-registry.js';

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

const readiness = productionReadiness();
const report = {
  applicationComplete: fileChecks.every((item) => item.present),
  fileChecks,
  ...readiness,
};

console.log(JSON.stringify(report, null, 2));

if (!report.applicationComplete) process.exitCode = 1;
