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
const sidepanelSource = readFileSync(
  new URL('../src/sidepanel.js', import.meta.url),
  'utf8'
);

describe('sidepanel layout', () => {
  it.each(['sidepanel.css', 'horizontal.css', 'fixes.css'])(
    'loads the required %s stylesheet',
    stylesheet => {
      expect(sidepanelHtml).toContain(`href="${stylesheet}"`);
    }
  );

  it('centers the captured expression and positions only its number to the right', () => {
    expect(layoutFixes).toContain('.equation-snapshot{display:block;justify-self:center');
    expect(layoutFixes).toContain('padding:calc(5px * var(--equation-scale))');
    expect(layoutFixes).toContain(
      '.equation-label{position:absolute;right:calc(8px * var(--equation-scale))'
    );
    expect(layoutFixes).toContain('font:700 calc(17px * var(--equation-scale))');
    expect(layoutFixes).not.toContain('grid-template-columns:minmax(0,1fr) max-content');
  });

  it('centers the three primary playback controls independently', () => {
    expect(layoutFixes).toContain('grid-template-columns:40px 52px 40px');
    expect(layoutFixes).toContain('.progress{align-self:start}');
    expect(layoutFixes).toContain('.transport{position:relative;z-index:2');
    expect(layoutFixes).toContain('.transport #replaySentence{position:absolute');
    expect(layoutFixes).toContain('.transport #play{grid-column:2}');
  });

  it('does not duplicate the passage with the removed synchronized context', () => {
    expect(sidepanelHtml).not.toContain('id="betaFeatures"');
    expect(sidepanelHtml).not.toContain('id="betaBadge"');
    expect(sidepanelSource).not.toContain('createSynchronizedContext');
    expect(sidepanelSource).toContain(
      'if (_removedBetaFeature === true) supportedSettings.horizontalContext = false'
    );
  });

  it('offers an explicit local PDF fallback for Firefox', () => {
    expect(sidepanelHtml).toContain('id="localPdfPicker"');
    expect(sidepanelHtml).toContain('accept="application/pdf,.pdf"');
    expect(sidepanelSource).toContain('payloadWithCachedLocalPdf');
    expect(sidepanelSource).toContain('localPdfCache.data.slice()');
  });
});
