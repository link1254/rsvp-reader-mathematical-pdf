import { describe, expect, it } from 'vitest';
import {
  DEFAULT_READER_SIZE,
  equationSnapshotWidth,
  readerContentScale,
  readerWindowLayout,
  readerWindowSize
} from '../src/window-layout.js';

describe('readerWindowLayout', () => {
  it('uses the larger default size and centers it in the parent window', () => {
    expect(readerWindowLayout({
      width: 1400,
      height: 900,
      left: 100,
      top: 50
    })).toEqual({
      ...DEFAULT_READER_SIZE,
      left: 300,
      top: 190
    });
  });

  it('reuses a saved reader size', () => {
    expect(readerWindowLayout(
      { width: 1400, height: 900, left: 0, top: 0 },
      { width: 860, height: 540 }
    )).toEqual({
      width: 860,
      height: 540,
      left: 270,
      top: 180
    });
  });

  it('keeps an oversized saved window inside the available parent bounds', () => {
    expect(readerWindowLayout(
      { width: 800, height: 600, left: 20, top: 10 },
      { width: 1600, height: 1200 }
    )).toEqual({
      width: 760,
      height: 560,
      left: 40,
      top: 30
    });
  });
});

describe('readerWindowSize', () => {
  it('stores only valid rounded dimensions', () => {
    expect(readerWindowSize({ width: 812.6, height: 507.4 })).toEqual({
      width: 813,
      height: 507
    });
    expect(readerWindowSize({ width: undefined, height: 507 })).toBeNull();
  });
});

describe('readerContentScale', () => {
  it('keeps the configured font size at the default viewport height', () => {
    expect(readerContentScale(255)).toBe(1);
    expect(readerContentScale(180)).toBe(1);
  });

  it('grows reading content with the viewport and caps the result', () => {
    expect(readerContentScale(380)).toBe(1.25);
    expect(readerContentScale(900)).toBe(1.6);
  });

  it('does not enlarge the compact vertical layout', () => {
    expect(readerContentScale(500, false)).toBe(1);
    expect(readerContentScale(undefined)).toBe(1);
  });
});

describe('equationSnapshotWidth', () => {
  it('enlarges equation captures with the reader content scale', () => {
    expect(equationSnapshotWidth(240, 1)).toBe(250);
    expect(equationSnapshotWidth(240, 1.25)).toBe(313);
    expect(equationSnapshotWidth(240, 1.6)).toBe(400);
  });

  it('rejects invalid widths and clamps invalid scales', () => {
    expect(equationSnapshotWidth(0, 1.4)).toBeNull();
    expect(equationSnapshotWidth(240, 3)).toBe(400);
    expect(equationSnapshotWidth(240, Number.NaN)).toBe(250);
  });
});
