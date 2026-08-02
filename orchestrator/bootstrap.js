import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const storageDir = path.resolve(process.env.COREAXIS_STORAGE_DIR || path.join(root, '.coreaxis'));
const sourceMemory = path.join(root, 'orchestrator', 'config', 'coreaxis-brand-memory.json');
const targetMemory = path.join(storageDir, 'brand', 'memory.json');

await fs.mkdir(path.join(storageDir, 'campaigns'), { recursive: true });
await fs.mkdir(path.join(storageDir, 'brand'), { recursive: true });
await fs.mkdir(path.join(storageDir, 'logs'), { recursive: true });

try {
  await fs.access(targetMemory);
} catch {
  await fs.copyFile(sourceMemory, targetMemory);
}

console.log(JSON.stringify({ ok: true, storageDir, brandMemory: targetMemory }));
