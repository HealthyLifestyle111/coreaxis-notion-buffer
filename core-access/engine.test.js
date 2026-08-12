const { route } = require('./engine');

const cases = [
  [{ intent:'peptide' }, 'peptide_direct'],
  [{ intent:'cellcore', specificity:'exact' }, 'cellcore_direct'],
  [{ intent:'foundational' }, 'cellular_cleanse'],
  [{ intent:'womens' }, 'pomegranate'],
  [{ intent:'menopause', life_stage:'menopause' }, 'menopause_core'],
  [{ intent:'fertility' }, 'ovo'],
  [{ intent:'mens', scope:'self' }, 'oyster'],
  [{ scope:'pet', intent:'pet' }, 'vibrant_pets'],
  [{ scope:'household' }, 'healthier_together'],
  [{ intent:'unknown', specificity:'unsure' }, 'concierge_review']
];

for (const [input, expected] of cases) {
  const actual = route(input).route;
  if (actual !== expected) throw new Error(`${JSON.stringify(input)} -> ${actual}; expected ${expected}`);
}

console.log(`PASS: ${cases.length} Core Access routes`);
