import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const manifest = JSON.parse(
  readFileSync(new URL('../manifest.json', import.meta.url), 'utf8')
);
const background = readFileSync(
  new URL('../src/background.js', import.meta.url),
  'utf8'
);
const content = readFileSync(
  new URL('../src/content.js', import.meta.url),
  'utf8'
);
const sidepanel = readFileSync(
  new URL('../src/sidepanel.js', import.meta.url),
  'utf8'
);

describe('web reader integration', () => {
  it('injects the extractor only after an explicit user action', () => {
    expect(manifest.permissions).toContain('activeTab');
    expect(manifest.permissions).toContain('scripting');
    expect(manifest).not.toHaveProperty('content_scripts');
    expect(background).toContain("files: ['src/content.js']");
    expect(background).toContain("{ type: 'GET_STRUCTURED_SELECTION' }");
  });

  it('recognizes KaTeX, MathML, and MathJax without site-specific selectors', () => {
    expect(content).toContain("element.localName === 'math'");
    expect(content).toContain("element.localName === 'mjx-container'");
    expect(content).toContain(".katex-display, .katex");
    expect(content).toContain('application/x-tex');
    expect(content).not.toContain('chatgpt.com');
    expect(content).not.toContain('claude.ai');
  });

  it('reads selected equations from the original DOM instead of a partial clone', () => {
    expect(content).toContain('closestMathContainer(commonAncestor)');
    expect(content).toContain("element.querySelector?.('.katex-html')");
    expect(content).not.toContain('cloneContents()');
  });

  it('dispatches both source types into the existing reader interface', () => {
    expect(sidepanel).toContain('renderVisualSelectionFromPdf');
    expect(sidepanel).toContain('renderVisualSelectionFromWeb');
    expect(sidepanel).toContain('const renderSelection = isWebSelection');
  });
});
