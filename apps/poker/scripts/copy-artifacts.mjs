import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..', '..');
const DEST = resolve(__dirname, '..', 'public', 'artifacts');

mkdirSync(DEST, { recursive: true });

const circuits = ['key_ownership', 'decrypt_card', 'shuffle_encrypt'];

for (const name of circuits) {
  // Copy compiled circuit JSON
  const jsonSrc = resolve(ROOT, 'circuits', 'target', `${name}.json`);
  if (existsSync(jsonSrc)) {
    copyFileSync(jsonSrc, resolve(DEST, `${name}.json`));
    console.log(`Copied ${name}.json`);
  } else {
    console.warn(`WARNING: ${jsonSrc} not found`);
  }

  // Copy verification key binary
  const vkSrc = resolve(ROOT, 'circuits', 'target', `vk_${name}`, 'vk');
  if (existsSync(vkSrc)) {
    copyFileSync(vkSrc, resolve(DEST, `vk_${name}`));
    console.log(`Copied vk_${name}`);
  } else {
    console.warn(`WARNING: ${vkSrc} not found`);
  }
}

// Copy bb.js WASM (barretenberg) - bb.js fetchCode needs these served via wasmPath
const bbWasmSrc = resolve(__dirname, '..', 'node_modules', '@aztec', 'bb.js', 'dest', 'node', 'barretenberg_wasm');
const wasmThreads = resolve(bbWasmSrc, 'barretenberg-threads.wasm.gz');
if (existsSync(wasmThreads)) {
  copyFileSync(wasmThreads, resolve(DEST, 'barretenberg-threads.wasm.gz'));
  copyFileSync(wasmThreads, resolve(DEST, 'barretenberg.wasm.gz'));
  console.log('Copied barretenberg WASM files');
} else {
  console.warn(`WARNING: ${wasmThreads} not found`);
}

console.log('Artifacts copied to public/artifacts/');
