import fs from 'node:fs/promises';

const registryPath = new URL('../production/build-registry.json', import.meta.url);
const raw = await fs.readFile(registryPath, 'utf8');
const registry = JSON.parse(raw);

if (registry.schemaVersion !== 1) {
  throw new Error('Unsupported build registry schemaVersion');
}

if (!Array.isArray(registry.builds) || registry.builds.length !== 3) {
  throw new Error('Registry must contain exactly the three governed active builds');
}

const expected = new Set(['coreaxis-loop', 'wellnessbotai', 'iterra']);
for (const build of registry.builds) {
  if (!expected.delete(build.id)) throw new Error(`Unexpected or duplicate build id: ${build.id}`);
  if (!build.name || !build.status) throw new Error(`${build.id}: name and status are required`);
  if (!Array.isArray(build.platforms) || build.platforms.length === 0) {
    throw new Error(`${build.id}: at least one production platform is required`);
  }
  if (!Array.isArray(build.requiredEvidence) || build.requiredEvidence.length === 0) {
    throw new Error(`${build.id}: requiredEvidence cannot be empty`);
  }
  if (!Array.isArray(build.humanOnly)) throw new Error(`${build.id}: humanOnly must be an array`);
}

if (expected.size) throw new Error(`Missing governed build(s): ${[...expected].join(', ')}`);

console.log('Build registry valid.');
for (const build of registry.builds) {
  console.log(`- ${build.name}: ${build.status}; evidence gates=${build.requiredEvidence.length}`);
}
