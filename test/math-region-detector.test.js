import { describe, expect, it } from 'vitest';
import {
  mathRegionCropBounds,
  decodeMathRegions,
  modelGeometry,
  nonMaxSuppression,
  selectRegionForLabel,
  selectRegionForRect
} from '../src/math-region-detector.js';

describe('local mathematical region detector', () => {
  it('preserves the page ratio and pads the model input to its stride', () => {
    expect(modelGeometry(1190, 1684)).toEqual({
      scale: 768 / 1190,
      targetWidth: 768,
      resizedHeight: 1087,
      targetHeight: 1088
    });
  });

  it('decodes inline and display boxes from the YOLO output', () => {
    const output = {
      dims: [1, 6, 2],
      data: new Float32Array([
        100, 300,
        50, 150,
        40, 80,
        20, 30,
        .9, .1,
        .2, .95
      ])
    };

    const regions = decodeMathRegions(output, { scale: 1 }, .8);

    expect(regions).toHaveLength(2);
    expect(regions.find(region => region.kind === 'inline')).toMatchObject({
      x: 80,
      y: 40,
      width: 40,
      height: 20
    });
    expect(regions.find(region => region.kind === 'display')).toMatchObject({
      x: 260,
      y: 135,
      width: 80,
      height: 30
    });
  });

  it('removes overlapping duplicates of the same class', () => {
    const regions = nonMaxSuppression([
      { x: 10, y: 10, width: 100, height: 30, kind: 'display', confidence: .95 },
      { x: 12, y: 11, width: 98, height: 30, kind: 'display', confidence: .8 },
      { x: 12, y: 11, width: 98, height: 30, kind: 'inline', confidence: .85 }
    ]);

    expect(regions).toHaveLength(2);
    expect(regions.find(region => region.kind === 'display')?.confidence).toBe(.95);
  });

  it('associates a numbered formula with the display box on its baseline', () => {
    const display = { x: 100, y: 200, width: 400, height: 45, kind: 'display', confidence: .92 };
    const inline = { x: 200, y: 205, width: 50, height: 20, kind: 'inline', confidence: .96 };

    expect(selectRegionForLabel([inline, display], 225)).toBe(display);
  });

  it('refuses an ambiguous overlap for an inline formula', () => {
    const first = { x: 100, y: 200, width: 80, height: 20, kind: 'inline', confidence: .9 };
    const second = { x: 170, y: 200, width: 80, height: 20, kind: 'inline', confidence: .91 };
    const rect = { x: 120, y: 195, width: 110, height: 30 };

    expect(selectRegionForRect([first, second], rect)).toBeNull();
  });

  it('scales the detected crop without changing its logical region', () => {
    const bounds = mathRegionCropBounds(
      { width: 500, height: 400 },
      { x: 10.5, y: 20.5, width: 100, height: 50 },
      8,
      2
    );

    expect(bounds).toEqual({ x: 5, y: 25, width: 232, height: 132 });
  });
});
