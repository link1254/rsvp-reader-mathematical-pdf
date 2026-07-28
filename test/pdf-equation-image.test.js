import { describe, expect, it } from 'vitest';
import {
  findMathItemRange,
  findMathItemRangeFromContext,
  findNumberedEquationItems,
  resolvePdfUrl,
  visualRsvpItems
} from '../src/pdf-equation-image.js';

describe('PDF source resolution', () => {
  it('uses a direct local PDF tab URL', () => {
    expect(resolvePdfUrl({ tabUrl: 'file:///C:/Documents/physics.pdf' })).toContain('physics.pdf');
  });
  it('extracts a PDF hidden in the Edge viewer URL', () => {
    const payload = { pageUrl: 'extension://viewer/index.html?file=file%3A%2F%2F%2FC%3A%2FDocuments%2Fphysics.pdf' };
    expect(resolvePdfUrl(payload)).toBe('file:///C:/Documents/physics.pdf');
  });
  it('keeps equation parentheses distinct from a section number', () => {
    const section = '1.2.'.replace(/\s/g, '');
    const equation = '(1.2)'.replace(/\s/g, '');
    expect(section.includes(equation)).toBe(false);
  });
  it('preserves paragraph boundaries in the RSVP word stream', () => {
    const result = visualRsvpItems([{
      type: 'text',
      value: 'A complete paragraph.',
      paragraphEnd: true
    }], null, 1);

    expect(result.items.at(-1)).toMatchObject({
      value: 'paragraph.',
      type: 'word',
      paragraphEnd: true
    });
  });
  it('restores a PDF math glyph omitted by the Edge selection', () => {
    const items = [
      { str: 'The D’Alembertian operator' }, { str: ' ' }, { str: '\u0003' }, { str: ' ' },
      { str: '=' }, { str: ' ' }, { str: '∂' }, { str: '2' }, { str: '' }, { str: 't' },
      { str: ' ' }, { str: '−' }, { str: ' ' }, { str: 'c' }, { str: '2' }, { str: '∇' },
      { str: '2' }, { str: ' ' }, { str: 'ensures invariance' }
    ];

    const range = findMathItemRange(items, '= ∂2 t − c2∇2');

    expect(range).toEqual({ start: 2, end: 16 });
    expect(items[range.start].str).toBe('\u0003');
  });
  it('matches a fraction when Edge omits an internal hbar glyph', () => {
    const items = [
      { str: 'Schroedinger :' }, { str: ' ' }, { str: 'E' }, { str: ' ' }, { str: '=' },
      { str: ' ' }, { str: 'ℏ' }, { str: '2' }, { str: 'k' }, { str: '2' }, { str: '' },
      { str: '2' }, { str: 'm' }, { str: ' ' }, { str: '⇒' }, { str: ' ' }, { str: 'Klein' }
    ];

    const range = findMathItemRange(items, 'E = 2k2 2m ⇒');

    expect(range).toEqual({ start: 2, end: 14 });
    expect(items.slice(range.start, range.end + 1).some(item => item.str === 'ℏ')).toBe(true);
  });
  it('does not skip ordinary prose while matching a formula', () => {
    const items = [{ str: 'E' }, { str: '=' }, { str: 'missing' }, { str: '2' }, { str: 'm' }];

    expect(findMathItemRange(items, 'E = 2m')).toBeNull();
  });
  it('requires context when the same formula fragment occurs more than once', () => {
    const items = [
      { str: 'before first' }, { str: 'i' }, { str: '∂' }, { str: 't − m2c4' },
      { str: 'between formulas' }, { str: 'i' }, { str: '∂' }, { str: 't − m2c4' },
      { str: 'after second' }
    ];

    expect(findMathItemRange(items, 'i ∂t − m2c4')).toBeNull();
    expect(findMathItemRange(items, 'i ∂t − m2c4', { start: 5, end: 7 })).toEqual({ start: 5, end: 7 });
  });
  it('locates a formula between stable prose anchors as a fallback', () => {
    const items = [
      { str: 'the non-relativistic case Schroedinger :' }, { str: ' ' }, { str: 'E' },
      { str: '=' }, { str: 'unmapped-glyphs' }, { str: '⇒' }, { str: ' ' },
      { str: 'Klein − Gordon :' }, { str: 'E' }, { str: '=' }
    ];

    const range = findMathItemRangeFromContext(
      items,
      'the non-relativistic case Schroedinger :',
      'Klein − Gordon'
    );

    expect(range).toEqual({ start: 2, end: 5 });
  });
  it('includes tall roots between the neighbouring paragraphs of a numbered equation', () => {
    const item = (str, y, height = 10) => ({ str, width: 10, height, transform: [1, 0, 0, 1, 0, y] });
    const items = [
      item('Indeed the equation can formally be written as', 226),
      item('(', 214), item('ℏ', 206), item('2', 210, 7), item('√', 216),
      item('m', 206), item('2', 209, 7), item(') = 0', 206),
      item('(1.4)', 206),
      item('where the presence of the two factors is important', 187)
    ];

    const equationItems = findNumberedEquationItems(items, items[8]);

    expect(equationItems.map(entry => entry.str)).toContain('√');
    expect(equationItems.map(entry => entry.str)).not.toContain(items[0].str);
    expect(equationItems.map(entry => entry.str)).not.toContain(items[9].str);
  });
  it('removes an isolated prose fragment above a numbered equation', () => {
    const item = (str, x, y, width = 10) => ({ str, width, height: 10, transform: [1, 0, 0, 1, x, y] });
    const items = [
      item('Its most obvious generalization is given by Klein-Gordon', 50, 440, 400),
      item('equation', 50, 428, 38),
      item('(', 166, 425), item('ℏ', 171, 416), item('2', 176, 421),
      item('∂', 181, 416), item('2', 187, 421), item(') = 0', 200, 416, 30),
      item('(1.2)', 524, 416, 21),
      item('The D’Alembertian operator ensures Lorentz invariance', 50, 400, 300)
    ];

    const equationItems = findNumberedEquationItems(items, items[8]);

    expect(equationItems.map(entry => entry.str)).not.toContain('equation');
    expect(equationItems.map(entry => entry.str)).toContain('ℏ');
    expect(equationItems.map(entry => entry.str)).toContain('(1.2)');
  });
});
