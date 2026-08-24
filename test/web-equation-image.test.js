import { describe, expect, it } from 'vitest';
import {
  sourceMathMl,
  webEquationCaptureCrop
} from '../src/web-equation-image.js';

describe('web equation image sources', () => {
  it('prefers source MathML over a flattened LaTeX fallback', () => {
    const mathml = '<math><mrow><mtext>corrections dues à </mtext><mi>H</mi></mrow></math>';
    expect(sourceMathMl({
      mathml,
      latex: 'correctionsduesàH'
    })).toBe(mathml);
  });

  it('maps a visible CSS rectangle into capture pixels with padding', () => {
    expect(webEquationCaptureCrop({
      captureRect: { x: 100, y: 50, width: 300, height: 40 },
      captureViewport: { width: 1000, height: 500 }
    }, 2000, 1000)).toEqual({
      x: 184,
      y: 84,
      width: 632,
      height: 112,
      pixelRatio: 2
    });
  });
});
