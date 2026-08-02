import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { cpSync } from 'node:fs';

function packageNameFromModuleId(moduleId) {
  const normalized = moduleId.replaceAll('\\', '/');
  const marker = '/node_modules/';
  const start = normalized.lastIndexOf(marker);
  if (start === -1) return null;

  const parts = normalized.slice(start + marker.length).split('/');
  return parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
}

export default defineConfig(({ mode }) => {
  const firefox = mode === 'firefox';
  const outDir = firefox ? 'dist-firefox' : 'dist';
  const manifest = firefox ? 'manifest.firefox.json' : 'manifest.json';

  return {
    base: './',
    plugins: [{
      name: 'copy-extension-metadata',
      generateBundle(_options, bundle) {
        const bundledPackages = new Set();

        for (const output of Object.values(bundle)) {
          if (output.type !== 'chunk') continue;
          for (const moduleId of Object.keys(output.modules)) {
            const packageName = packageNameFromModuleId(moduleId);
            if (packageName) bundledPackages.add(packageName);
          }
        }

        this.emitFile({
          type: 'asset',
          fileName: 'BUNDLED_DEPENDENCIES.json',
          source: `${JSON.stringify([...bundledPackages].sort(), null, 2)}\n`
        });
      },
      closeBundle() {
        cpSync(
          resolve(import.meta.dirname, manifest),
          resolve(import.meta.dirname, outDir, 'manifest.json')
        );
        for (const file of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) {
          cpSync(
            resolve(import.meta.dirname, file),
            resolve(import.meta.dirname, outDir, file)
          );
        }
      }
    }],
    build: {
      outDir,
      emptyOutDir: true,
      rollupOptions: {
        input: {
          reader: resolve(import.meta.dirname, 'src/reader.html'),
          sidepanel: resolve(import.meta.dirname, 'src/sidepanel.html'),
          popup: resolve(import.meta.dirname, 'src/popup.html'),
          background: resolve(import.meta.dirname, 'src/background.js'),
          content: resolve(import.meta.dirname, 'src/content.js')
        },
        output: { entryFileNames: 'src/[name].js', chunkFileNames: 'assets/[name]-[hash].js' }
      }
    }
  };
});
