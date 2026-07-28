import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OVERVIEW_MATH_MODE,
  normalizeOverviewMathMode,
  OVERVIEW_MATH_MODES
} from '../src/overview-display.js';

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

describe('passage overview mathematics display', () => {
  it('offers labels and previews while defaulting to labels', () => {
    expect(OVERVIEW_MATH_MODES).toEqual(['labels', 'previews']);
    expect(DEFAULT_OVERVIEW_MATH_MODE).toBe('labels');
    expect(normalizeOverviewMathMode('previews')).toBe('previews');
    expect(normalizeOverviewMathMode('unknown')).toBe('labels');
    expect(html).toContain('<select id="overviewMathMode">');
  });

  it('persists the choice and uses available equation captures in previews', () => {
    expect(source).toContain('overviewMathMode: state.overviewMathMode');
    expect(source).toContain("state.overviewMathMode === 'previews'");
    expect(source).toContain("button.classList.add('math-preview')");
    expect(source).toContain("$('#overviewMathMode').value = state.overviewMathMode");
    expect(stylesheet).toContain('.paragraph-text button.math-preview img');
    expect(stylesheet).toContain('max-height:calc(24px * var(--reader-scale))');
  });
});
