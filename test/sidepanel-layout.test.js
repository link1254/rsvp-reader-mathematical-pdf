import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sidepanelHtml = readFileSync(
  new URL('../src/sidepanel.html', import.meta.url),
  'utf8'
);
const layoutFixes = readFileSync(
  new URL('../src/fixes.css', import.meta.url),
  'utf8'
);

describe('sidepanel layout', () => {
  it.each(['sidepanel.css', 'horizontal.css', 'fixes.css'])(
    'loads the required %s stylesheet',
    stylesheet => {
      expect(sidepanelHtml).toContain(`href="${stylesheet}"`);
    }
  );

  it('places a readable equation number beside the captured image', () => {
    expect(layoutFixes).toContain('.equation-label{position:static');
    expect(layoutFixes).toContain('font:700 calc(17px * var(--reader-scale))');
    expect(layoutFixes).toContain('grid-template-columns:minmax(0,1fr) max-content');
  });

  it('centers the three primary playback controls independently', () => {
    expect(layoutFixes).toContain('grid-template-columns:40px 52px 40px');
    expect(layoutFixes).toContain('.transport #replaySentence{position:absolute');
    expect(layoutFixes).toContain('.transport #play{grid-column:2}');
  });
});
