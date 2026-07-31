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
const fixes = readFileSync(
  new URL('../src/fixes.css', import.meta.url),
  'utf8'
);

describe('horizontal reading context', () => {
  it('is an optional setting that remains disabled by default', () => {
    expect(html).toContain('id="horizontalContext" type="checkbox"');
    expect(source).toContain('horizontalContext: false');
  });

  it('allows zero or one surrounding word', () => {
    expect(html).toContain('<option value="0"');
    expect(html).toContain('<option value="1"');
    expect(html).toContain('data-i18n="contextWord">1 mot</option>');
    expect(source).toContain('readerSideContextText(');
    expect(source).toContain('state.contextSize');
  });

  it('keeps equation placeholders out of the reading viewport', () => {
    expect(source).toContain('readerSentenceContextEntries(');
    expect(source).toContain("'previous'");
    expect(source).toContain("'next'");
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
    expect(source).toContain('stablePassageWordFontSize(');
    expect(source).toContain('const contextGutter =');
  });

  it('anchors context to the visible word and truncates toward the outer edges', () => {
    expect(source).toContain('function layoutHorizontalContext');
    expect(source).toContain('let wordLeft =');
    expect(source).toContain('let wordRight =');
    expect(source).toContain('fitContextText(previous, true)');
    expect(source).toContain('fitContextText(next, false)');
    expect(source).toContain("let best = '\\u2026'");
    expect(fixes).toContain(
      '.context{font-size:min(calc(22px * var(--reader-scale)),28px)}'
    );
  });
});
