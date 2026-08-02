import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'dist-firefox');
const manifest = JSON.parse(readFileSync(resolve(output, 'manifest.json'), 'utf8'));

if (!manifest.background?.scripts?.includes('src/background.js')) {
  throw new Error('The Firefox build must use a background script.');
}
if (!manifest.sidebar_action?.default_panel || manifest.side_panel) {
  throw new Error('The Firefox build must use sidebar_action instead of side_panel.');
}
if (manifest.permissions.includes('sidePanel') || manifest.permissions.includes('tts')) {
  throw new Error('The Firefox build contains a Chromium-only permission.');
}

for (const file of [
  'LICENSE',
  'THIRD_PARTY_NOTICES.md',
  'BUNDLED_DEPENDENCIES.json',
  'src/background.js',
  'src/sidepanel.html',
  'models/pix2text-mfd-1.5.onnx',
  'models/ort-wasm-simd-threaded.wasm'
]) {
  if (!existsSync(resolve(output, file))) {
    throw new Error(`Firefox distribution file is missing: ${file}`);
  }
}

console.log('Firefox build structure and browser-specific manifest are consistent.');
