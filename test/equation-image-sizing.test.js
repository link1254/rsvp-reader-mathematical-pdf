import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(
  new URL('../src/sidepanel.html', import.meta.url),
  'utf8'
);
const source = readFileSync(
  new URL('../src/sidepanel.js', import.meta.url),
  'utf8'
);
const layoutFixes = readFileSync(
  new URL('../src/fixes.css', import.meta.url),
  'utf8'
);

describe('responsive equation image sizing', () => {
  it('offers and persists a dedicated equation image size control', () => {
    expect(html).toContain('id="equationImageSize"');
    expect(html).toContain('min="60" max="180" step="10" value="100"');
    expect(source).toContain('equationImageSize: state.equationImageSize');
    expect(source).toContain(
      "document.documentElement.style.setProperty('--equation-scale'"
    );
  });

  it('centers equations and lets the passage overview fill the lower area', () => {
    expect(layoutFixes).toContain(
      'grid-template-rows:25px minmax(180px,3fr) minmax(90px,1fr)'
    );
    expect(layoutFixes).toContain('.equation-card{align-self:center');
    expect(layoutFixes).toContain(
      '.paragraph-text{height:100%;min-height:0;max-height:none}'
    );
  });
});
