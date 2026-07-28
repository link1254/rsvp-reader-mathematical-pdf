import { describe, expect, it } from 'vitest';
import { unicodeMathToLatex } from '../src/math-renderer.js';

describe('mathematical rendering', () => {
  it('converts unicode symbols to LaTeX', () => {
    expect(unicodeMathToLatex('E = mc²')).toContain('mc^{2}');
    expect(unicodeMathToLatex('x → ∞')).toContain('\\to');
    expect(unicodeMathToLatex('x → ∞')).toContain('\\infty');
  });
  it('preserves explicit LaTeX commands', () => {
    expect(unicodeMathToLatex('\\frac{x}{2}')).toBe('\\frac{x}{2}');
  });
  it('converts common quantum mechanics glyphs', () => {
    const latex = unicodeMathToLatex('ℏ² ∂ ψ = 0');
    expect(latex).toContain('\\hbar ^{2}');
    expect(latex).toContain('\\partial');
    expect(latex).toContain('\\psi');
  });
  it('restores compact superscripts extracted by Edge PDF', () => {
    const latex = unicodeMathToLatex('= ∂2 t − c2∇2');

    expect(latex).toContain('\\partial ^{2}_{t}');
    expect(latex).toContain('c^{2}\\nabla ^{2}');
  });
});
