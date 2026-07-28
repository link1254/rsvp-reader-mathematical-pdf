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
const stylesheet = readFileSync(
  new URL('../src/sidepanel.css', import.meta.url),
  'utf8'
);

describe('horizontal reading context', () => {
  it('is an optional setting that remains disabled by default', () => {
    expect(html).toContain('id="horizontalContext" type="checkbox"');
    expect(source).toContain('horizontalContext: false');
  });

  it('persists and restores the selected layout', () => {
    expect(source).toContain('horizontalContext: state.horizontalContext');
    expect(source).toContain("$('#horizontalContext').checked = state.horizontalContext");
    expect(source).toContain("classList.toggle('context-horizontal', stableHorizontalContextEnabled())");
  });

  it('places previous, current, and next words on one stable line', () => {
    expect(stylesheet).toContain('.viewport.context-horizontal');
    expect(stylesheet).toContain('.context-horizontal .current{position:absolute');
    expect(stylesheet).toContain('.context-horizontal .previous');
    expect(stylesheet).toContain('.context-horizontal .next');
    expect(source).toContain('stableHorizontalContextEnabled() ? current.clientWidth : viewport.clientWidth - 32');
  });

  it('anchors context to the visible word and truncates toward the outer edges', () => {
    expect(source).toContain('function layoutHorizontalContext');
    expect(source).toContain('fitContextText(previous, true)');
    expect(source).toContain('fitContextText(next, false)');
    expect(source).toContain("let best = '\\u2026'");
  });
});
