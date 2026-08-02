import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const distributionDirectory = process.argv[2] || 'dist';
if (!['dist', 'dist-firefox'].includes(distributionDirectory)) {
  throw new Error(`Unsupported distribution directory: ${distributionDirectory}`);
}
const projectLicense = 'PolyForm-Noncommercial-1.0.0';
const projectLicenseTitle = '# PolyForm Noncommercial License 1.0.0';
const requiredNotice = 'Required Notice: Copyright 2026 Axel.';
const noticePath = resolve(root, 'THIRD_PARTY_NOTICES.md');
const notice = readFileSync(noticePath, 'utf8');
const projectPackage = JSON.parse(
  readFileSync(resolve(root, 'package.json'), 'utf8')
);
const projectLicenseText = readFileSync(resolve(root, 'LICENSE'), 'utf8');
const packageLock = JSON.parse(
  readFileSync(resolve(root, 'package-lock.json'), 'utf8')
);
const allowedProductionLicenses = new Set([
  'Apache-2.0',
  'BSD-3-Clause',
  'ISC',
  'MIT',
  'OFL-1.1'
]);

const packages = [
  ['@fontsource/atkinson-hyperlegible', 'OFL-1.1'],
  ['@fontsource/opendyslexic', 'OFL-1.1'],
  ['@fontsource-variable/lexend', 'OFL-1.1'],
  ['pdfjs-dist', 'Apache-2.0'],
  ['onnxruntime-web', 'MIT'],
  ['onnxruntime-common', 'MIT'],
  ['katex', 'MIT'],
  ['vite', 'MIT'],
  ['vitest', 'MIT']
];

if (projectPackage.license !== projectLicense
  || packageLock.packages['']?.license !== projectLicense) {
  throw new Error(`Project metadata must declare ${projectLicense}.`);
}

if (!projectLicenseText.startsWith(projectLicenseTitle)
  || !projectLicenseText.includes(requiredNotice)) {
  throw new Error('The project license text or required copyright notice is missing.');
}

for (const [name, expectedLicense] of packages) {
  const packagePath = resolve(root, 'node_modules', name, 'package.json');
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));

  if (packageJson.license !== expectedLicense) {
    throw new Error(
      `${name} declares ${packageJson.license}; expected ${expectedLicense}. ` +
      'Review the dependency before distributing it.'
    );
  }

  if (!notice.includes(name) || !notice.includes(packageJson.version)) {
    throw new Error(
      `THIRD_PARTY_NOTICES.md must identify ${name} ${packageJson.version}.`
    );
  }
}

for (const [path, metadata] of Object.entries(packageLock.packages)) {
  if (!path.startsWith('node_modules/') || metadata.dev === true) continue;

  if (!allowedProductionLicenses.has(metadata.license)) {
    throw new Error(
      `${path} declares ${metadata.license ?? 'no license'}. ` +
      'Review this non-development dependency before distributing the project.'
    );
  }
}

const requiredSourceFiles = [
  'LICENSE',
  'THIRD_PARTY_NOTICES.md',
  'public/licenses/PDFJS-APACHE-2.0.txt',
  'public/licenses/ONNXRUNTIME-MIT.txt',
  'public/licenses/ONNXRUNTIME-THIRD-PARTY-NOTICES.txt',
  'public/licenses/PIX2TEXT-MFD-MIT.txt',
  'public/licenses/KATEX-MIT.txt',
  'public/licenses/ATKINSON-HYPERLEGIBLE-OFL-1.1.txt',
  'public/licenses/OPENDYSLEXIC-OFL-1.1.txt',
  'public/licenses/LEXEND-OFL-1.1.txt'
];

const requiredDistributionFiles = [
  'LICENSE',
  'THIRD_PARTY_NOTICES.md',
  'licenses/PDFJS-APACHE-2.0.txt',
  'licenses/ONNXRUNTIME-MIT.txt',
  'licenses/ONNXRUNTIME-THIRD-PARTY-NOTICES.txt',
  'licenses/PIX2TEXT-MFD-MIT.txt',
  'licenses/KATEX-MIT.txt',
  'licenses/ATKINSON-HYPERLEGIBLE-OFL-1.1.txt',
  'licenses/OPENDYSLEXIC-OFL-1.1.txt',
  'licenses/LEXEND-OFL-1.1.txt'
].map(file => `${distributionDirectory}/${file}`);

for (const file of [...requiredSourceFiles, ...requiredDistributionFiles]) {
  if (!existsSync(resolve(root, file))) {
    throw new Error(`Required licensing file is missing: ${file}`);
  }
}

const bundledPackages = JSON.parse(
  readFileSync(resolve(root, distributionDirectory, 'BUNDLED_DEPENDENCIES.json'), 'utf8')
);

for (const name of bundledPackages) {
  const packageJson = JSON.parse(
    readFileSync(resolve(root, 'node_modules', name, 'package.json'), 'utf8')
  );

  if (!notice.includes(name) || !notice.includes(packageJson.version)) {
    throw new Error(
      `The production bundle contains undocumented package ${name} ${packageJson.version}.`
    );
  }
}

const bundledArtifacts = [
  [
    'public/models/pix2text-mfd-1.5.onnx',
    '40d4fc852d99bcbf25a9478897d2f49fbbb8f7fdd6569c088cd1c31386293bd7'
  ],
  [
    'public/models/ort-wasm-simd-threaded.mjs',
    '30dd851d9c00622940500f71ddd2ff8820c5cb65270816080175b958705385a8'
  ],
  [
    'public/models/ort-wasm-simd-threaded.wasm',
    '71aef04959c5c1b6de461b6538e2058e306610034a85aad2742d0c7fd4533fe4'
  ]
];

for (const [file, expectedHash] of bundledArtifacts) {
  const hash = createHash('sha256')
    .update(readFileSync(resolve(root, file)))
    .digest('hex');

  if (hash !== expectedHash) {
    throw new Error(
      `${file} changed. Verify its source and license, then update its documented hash.`
    );
  }
}

console.log('License compliance files, dependency metadata, and bundled hashes are consistent.');
