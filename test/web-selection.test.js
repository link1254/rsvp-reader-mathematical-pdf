import { afterEach, describe, expect, it } from 'vitest';
import { setUiLanguage } from '../src/i18n.js';
import { webSelectionItems } from '../src/web-selection.js';

afterEach(() => setUiLanguage('fr'));

describe('structured web selections', () => {
  it('preserves text, equations, and paragraph order', () => {
    setUiLanguage('en');
    const items = webSelectionItems({
      webSelection: {
        segments: [
          { type: 'text', value: 'The result is' },
          {
            type: 'equation',
            value: 'E = mc^2',
            latex: 'E = mc^2',
            displayMode: true
          },
          { type: 'text', value: 'which completes the proof.', paragraphEnd: true }
        ]
      }
    });

    expect(items.map(item => item.type)).toEqual([
      'word', 'word', 'word', 'equation', 'word', 'word', 'word', 'word'
    ]);
    expect(items[3]).toMatchObject({
      value: 'Equation',
      equationId: 'web-equation-0',
      sourceType: 'html',
      latex: 'E = mc^2',
      displayMode: true
    });
    expect(items.at(-1)).toMatchObject({
      value: 'proof.',
      paragraphEnd: true
    });
  });

  it('keeps inline notation renderable without losing surrounding prose', () => {
    const items = webSelectionItems({
      webSelection: {
        segments: [
          { type: 'text', value: 'Pour' },
          {
            type: 'equation',
            accessibleText: 'x',
            mathml: '<math><mi>x</mi></math>',
            displayMode: false
          },
          { type: 'text', value: 'positif.' }
        ]
      }
    });

    expect(items.map(item => item.type)).toEqual(['word', 'equation', 'word']);
    expect(items[1]).toMatchObject({
      value: 'Notation mathématique',
      equationText: 'x',
      mathKind: 'inline'
    });
  });

  it('keeps capture geometry for HTML-only equation renderers', () => {
    const captureRect = { x: 80, y: 120, width: 420, height: 60 };
    const captureViewport = { width: 1280, height: 720 };
    const [item] = webSelectionItems({
      webSelection: {
        segments: [{
          type: 'equation',
          accessibleText: 'correctionsduesàH',
          captureRect,
          captureViewport,
          displayMode: true
        }]
      }
    });

    expect(item).toMatchObject({ captureRect, captureViewport });
  });

  it('falls back to the selected plain text on unsupported pages', () => {
    expect(webSelectionItems({ text: 'A readable fallback.' }))
      .toEqual([
        { value: 'A', type: 'word' },
        { value: 'readable', type: 'word' },
        { value: 'fallback.', type: 'word', paragraphEnd: true }
      ]);
  });
});
