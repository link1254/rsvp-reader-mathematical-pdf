import { describe, expect, it } from 'vitest';
import { cropEquationRect, findEquationBand } from '../src/equation-image.js';

function syntheticPage(width = 500, height = 260) {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  const ink = (x0, y0, x1, y1) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4; data[i] = 20; data[i + 1] = 20; data[i + 2] = 20; data[i + 3] = 255;
    }
  };
  // Ligne de texte ordinaire commençant à gauche.
  for (let x = 20; x < 470; x += 18) ink(x, 35, x + 10, 42);
  // Formule centrée et numéro à droite.
  for (let x = 130; x < 365; x += 22) ink(x, 105, x + 13, 118);
  ink(440, 105, 475, 118);
  return { data, width, height };
}

describe('equation image detection', () => {
  it('finds a centered numbered equation rather than prose', () => {
    const rect = findEquationBand(syntheticPage());
    expect(rect).not.toBeNull();
    expect(rect.y).toBeGreaterThan(70);
    expect(rect.y).toBeLessThan(120);
    expect(rect.width).toBeGreaterThan(300);
  });
  it('requires a right-side equation number', () => {
    const page = syntheticPage();
    for (let y = 95; y < 130; y++) for (let x = 410; x < page.width; x++) {
      const i = (y * page.width + x) * 4; page.data[i] = page.data[i + 1] = page.data[i + 2] = 255;
    }
    expect(findEquationBand(page)).toBeNull();
  });

  it('keeps the equation baseline and excludes neighbouring prose', () => {
    const width = 120, height = 80;
    const data = new Uint8ClampedArray(width * height * 4).fill(255);
    const ink = (x0, y0, x1, y1) => {
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = (y * width + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = 20;
        data[i + 3] = 255;
      }
    };
    ink(10, 0, 110, 6);   // prose au-dessus
    ink(15, 32, 105, 56); // equation
    ink(5, 65, 115, 71);  // prose au-dessous

    const source = {
      width,
      height,
      getContext: () => ({ getImageData: () => ({ data, width, height }) })
    };
    const output = {
      width: 0,
      height: 0,
      draw: null,
      getContext() { return { drawImage: (...args) => { this.draw = args; } }; },
      toDataURL: () => 'data:image/png;base64,test'
    };
    const previousDocument = globalThis.document;
    globalThis.document = { createElement: () => output };
    try {
      const result = cropEquationRect(source, { x: 0, y: 0, width, height, baselineY: 50 });
      expect(result).toContain('data:image/png');
      expect(output.draw[2]).toBe(25);
      expect(output.draw[4]).toBe(38);
      expect(output.draw[2] + output.draw[4]).toBeLessThan(65);
    } finally {
      if (previousDocument === undefined) delete globalThis.document;
      else globalThis.document = previousDocument;
    }
  });
});
