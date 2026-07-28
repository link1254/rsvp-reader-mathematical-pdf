import { describe, expect, it } from 'vitest';
import {
  ADAPTIVE_PACING_MODES,
  isEquationLike,
  normalizeAdaptivePacing,
  parseEquationLabel,
  playbackAction,
  readingDelay,
  replaySentenceIndex,
  sentenceBounds,
  tokenizeDetectedProse,
  tokenizeSelection
} from '../src/selection-engine.js';

describe('PDF selection engine', () => {
  it('recognizes common equation label formats', () => {
    for (const label of ['(1)', '(2.4)', '(2.4a)', '(A.3)', '(A3)', '(IV.2)', '[4.2]']) {
      expect(parseEquationLabel(label)).toBe(label);
    }
    expect(parseEquationLabel('4.2')).toBeNull();
    expect(parseEquationLabel('4.2', { allowBare: true })).toBe('4.2');
    expect(parseEquationLabel('Eq. (4.2)')).toBeNull();
  });
  it('recognizes display equations', () => {
    expect(isEquationLike('E = mc²')).toBe(true);
    expect(isEquationLike('∫ f(x) dx = F(x) + C')).toBe(true);
  });
  it('keeps an equation line as one block', () => {
    const items = tokenizeSelection('On obtient alors :\nE = mc²\nCette relation est utile.');
    expect(items.find(item => item.type === 'equation')?.value).toBe('E = mc²');
  });
  it('does not classify a prose word as a mathematical variable', () => {
    const items = tokenizeSelection('The operator = ∂² remains useful.');
    expect(items.some(item => item.type === 'equation' && item.value.startsWith('operator'))).toBe(false);
  });
  it('never leaves a Greek notation as an ordinary RSVP word', () => {
    const items = tokenizeSelection('a scalar field ϕ(x) is considered');

    expect(items.find(item => item.value === 'ϕ(x)')?.type).toBe('equation');
  });
  it('keeps numbered references as prose after visual math detection', () => {
    const items = tokenizeDetectedProse('Applying eqs (4.99) to the field, by eq. (4.95)');

    expect(items.every(item => item.type === 'word')).toBe(true);
    expect(items.map(item => item.value)).toContain('(4.99)');
  });
  it('still masks a strong residual mathematical notation', () => {
    const items = tokenizeDetectedProse('the relation ϕ(x) = 0 remains');

    expect(items.some(item => item.type === 'equation')).toBe(true);
  });
  it('does not pause on an isolated relation sign', () => {
    const items = tokenizeSelection('The operator = value remains useful.');
    expect(items.find(item => item.value === '=')?.type).toBe('word');
  });
  it('keeps compact Edge PDF tokens in the same equation', () => {
    const items = tokenizeSelection('The D’Alembertian operator = ∂2 t − c2∇2 ensures invariance.');
    const equations = items.filter(item => item.type === 'equation');

    expect(equations).toEqual([{ value: '= ∂2 t − c2∇2', type: 'equation' }]);
  });
  it('keeps ordinary prose word by word', () => {
    expect(tokenizeSelection('Le résultat est important.').map(item => item.value)).toEqual(['Le', 'résultat', 'est', 'important.']);
  });
  it('does not turn a scientific paragraph into one giant equation', () => {
    const text = 'In particular the spectrum extends from E = −∞ to E = +∞. The existence of unbounded negative energies leads to instabilities.';
    const items = tokenizeSelection(text);
    expect(items.length).toBeGreaterThan(10);
    expect(items.some(item => item.type === 'equation' && item.value.includes('E = −∞'))).toBe(true);
  });
  it('gives equations a readable automatic delay', () => {
    expect(readingDelay({ type: 'equation', value: 'x=2' }, 300)).toBeGreaterThanOrEqual(1200);
  });
  it('keeps ordinary short words at the selected base speed', () => {
    const delays = ['un', 'lecture', 'article'].map(value => (
      readingDelay({ type: 'word', value }, 300, 'normal')
    ));

    expect(delays).toEqual([200, 200, 200]);
  });
  it('increases the delay progressively with word length', () => {
    const tenLetters = readingDelay({ type: 'word', value: 'abcdefghij' }, 300, 'normal');
    const fifteenLetters = readingDelay({ type: 'word', value: 'abcdefghijklmno' }, 300, 'normal');
    const twentyLetters = readingDelay({ type: 'word', value: 'abcdefghijklmnopqrst' }, 300, 'normal');

    expect(tenLetters).toBe(275);
    expect(fifteenLetters).toBe(400);
    expect(twentyLetters).toBe(525);
  });
  it('keeps a long word readable even at high speed', () => {
    const word = { type: 'word', value: 'straightforwardly' };

    expect(readingDelay(word, 300, 'normal')).toBe(450);
    expect(readingDelay(word, 300, 'strong')).toBe(600);
    expect(readingDelay(word, 600, 'strong')).toBe(500);
  });
  it('combines word length and punctuation bonuses', () => {
    const shortComma = readingDelay({ type: 'word', value: 'mot,' }, 300, 'normal');
    const shortPeriod = readingDelay({ type: 'word', value: 'mot.' }, 300, 'normal');
    const longComma = readingDelay({
      type: 'word',
      value: 'internationalisation,'
    }, 300, 'normal');

    expect(shortComma).toBe(300);
    expect(shortPeriod).toBe(500);
    expect(longComma).toBeGreaterThan(shortComma);
  });
  it('keeps sentence and paragraph pauses fixed when WPM increases', () => {
    const sentence = { type: 'word', value: 'fin.' };
    const paragraph = { ...sentence, paragraphEnd: true };

    expect(readingDelay(sentence, 300, 'normal')).toBe(500);
    expect(readingDelay(sentence, 600, 'normal')).toBe(400);
    expect(readingDelay(paragraph, 300, 'normal')).toBe(1100);
    expect(readingDelay(paragraph, 600, 'normal')).toBe(1000);
  });
  it('adds a small delay for numbers and acronyms', () => {
    expect(readingDelay({ type: 'word', value: '2026' }, 300, 'normal')).toBe(230);
    expect(readingDelay({ type: 'word', value: 'QFT' }, 300, 'normal')).toBe(230);
  });
  it('supports fixed timing and bounded adaptive profiles', () => {
    const difficult = { type: 'word', value: 'extraordinairementlongue.' };

    expect(readingDelay(difficult, 300, 'off')).toBe(200);
    expect(readingDelay(difficult, 300, 'light'))
      .toBeLessThan(readingDelay(difficult, 300, 'normal'));
    expect(readingDelay(difficult, 300, 'normal'))
      .toBeLessThan(readingDelay(difficult, 300, 'strong'));
    expect(readingDelay(difficult, 300, 'strong')).toBeLessThanOrEqual(1200);
  });
  it('restarts the current sentence, then moves to the previous one', () => {
    const items = [
      { type: 'word', value: 'Première' },
      { type: 'word', value: 'phrase.' },
      { type: 'word', value: 'Deuxième' },
      { type: 'word', value: 'phrase' },
      { type: 'word', value: 'sans' },
      { type: 'word', value: 'ponctuation', paragraphEnd: true },
      { type: 'word', value: 'Troisième' },
      { type: 'word', value: 'phrase.' }
    ];

    expect(sentenceBounds(items, 4)).toEqual({ start: 2, end: 5 });
    expect(replaySentenceIndex(items, 4)).toBe(2);
    expect(replaySentenceIndex(items, 2)).toBe(0);
    expect(sentenceBounds(items, 6)).toEqual({ start: 6, end: 7 });
  });
  it('normalizes stored adaptive pacing values safely', () => {
    expect(ADAPTIVE_PACING_MODES).toEqual(['off', 'light', 'normal', 'strong']);
    expect(normalizeAdaptivePacing('strong')).toBe('strong');
    expect(normalizeAdaptivePacing('unknown')).toBe('normal');
  });
  it('starts an ordinary paused passage and pauses one that is playing', () => {
    const items = [{ type: 'word', value: 'Result' }];

    expect(playbackAction({ items, index: 0, playing: false, equationMode: 'manual' }))
      .toBe('play');
    expect(playbackAction({ items, index: 0, playing: true, equationMode: 'manual' }))
      .toBe('pause');
  });
  it('uses playback controls to validate a manual equation', () => {
    const items = [
      { type: 'equation', value: 'Equation' },
      { type: 'word', value: 'Result' }
    ];

    expect(playbackAction({ items, index: 0, playing: false, equationMode: 'manual' }))
      .toBe('continue-equation');
    expect(playbackAction({ items: items.slice(0, 1), index: 0, playing: false, equationMode: 'manual' }))
      .toBe('finish-equation');
    expect(playbackAction({ items, index: 0, playing: false, equationMode: 'auto' }))
      .toBe('play');
  });
  it('does nothing when no passage is loaded', () => {
    expect(playbackAction({ items: [], index: 0, playing: false, equationMode: 'manual' }))
      .toBe('none');
  });
  it('groups a PDF equation extracted glyph by glyph', () => {
    const text = 'The equation is ( ℏ ² ∂ t ² − c ² ℏ ² ∇ ² + m ² c ⁴ ) ψ ( t , x ) = 0 . The operator ensures invariance.';
    const items = tokenizeSelection(text);
    const equations = items.filter(item => item.type === 'equation');
    expect(equations).toHaveLength(1);
    expect(equations[0].value).toContain('ℏ ² ∂ t ²');
    expect(items.some(item => item.value === 'operator')).toBe(true);
  });
  it('uses a right-side equation number to group a damaged PDF formula', () => {
    const text = 'given by the Klein-Gordon equation 2∂2 t − c2 2∇2 +m2c4 ψ(t,x) ≡ 2 +m2c4 ψ(t,x) = 0. (1.2) The operator ensures invariance.';
    const items = tokenizeSelection(text);
    const equation = items.find(item => item.type === 'equation');
    expect(equation?.value).toContain('+m2c4 ψ(t,x)');
    expect(equation?.value).not.toContain('(1.2)');
    expect(equation?.equationLabel).toBe('(1.2)');
    expect(items.filter(item => item.type === 'equation')).toHaveLength(1);
  });
  it('keeps compact powers inside the numbered equation instead of splitting it', () => {
    const text = 'having negative energy. We can then imagine writing instead an equation involving only one factor in order to eliminate the unwanted solutions (i ∂t − m2c4 − 2c2∇2)ψ(t,x) = 0. (1.5)';
    const equations = tokenizeSelection(text).filter(item => item.type === 'equation');

    expect(equations).toEqual([{
      value: '(i ∂t − m2c4 − 2c2∇2)ψ(t,x) = 0.',
      type: 'equation',
      equationLabel: '(1.5)'
    }]);
  });
  it('groups a formula when Edge puts its number on a separate line', () => {
    const text = 'given by the Klein-Gordon equation\n2∂2 t − c2 2∇2 +m2c4 ψ(t,x) ≡ 2 +m2c4 ψ(t,x) = 0.\n(1.2)\nThe operator ensures invariance.';
    const items = tokenizeSelection(text);
    const equations = items.filter(item => item.type === 'equation');
    expect(equations).toHaveLength(1);
    expect(equations[0].value).not.toContain('(1.2)');
    expect(equations[0].equationLabel).toBe('(1.2)');
    expect(items.some(item => item.value === '+m2c4')).toBe(false);
  });
  it('reassembles a fragmented appendix equation label', () => {
    const equations = tokenizeSelection('The result is E = mc² ( A . 3a ) Therefore it holds.')
      .filter(item => item.type === 'equation');

    expect(equations).toEqual([{
      value: 'E = mc²',
      type: 'equation',
      equationLabel: '(A.3a)'
    }]);
  });
  it('handles the PDF glyphs and equations from the reference page', () => {
    const text = 'Its most obvious generalization is given by the Klein-Gordon equation ( ℏ 2 ∂ 2 t − c 2 ℏ 2 ∇ 2 + m 2 c 4 ) ψ ( t, x ) ≡ ( ℏ 2 \u0003 + m 2 c 4 ) ψ ( t, x ) = 0 . (1.2) The D’Alembertian operator \u0003 = ∂ 2 t − c 2 ∇ 2 ensures invariance. Consequently Schroedinger : E = ℏ 2 k 2 2 m ⇒ Klein − Gordon : E = ± c √ m 2 c 2 + ℏ 2 k 2 . (1.3)';
    const equations = tokenizeSelection(text).filter(item => item.type === 'equation');

    expect(equations.find(item => item.equationLabel === '(1.2)')?.value).toContain('ℏ 2 ∂ 2 t');
    expect(equations.find(item => item.value.startsWith('□ ='))?.value).toBe('□ = ∂ 2 t − c 2 ∇ 2');
    expect(equations.find(item => item.equationLabel === '(1.3)')?.value).toMatch(/^E = ± c √/);
    expect(equations.some(item => item.value === '=')).toBe(false);
  });
});
