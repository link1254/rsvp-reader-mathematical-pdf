import { describe, expect, it } from 'vitest';
import {
  normalizeLoadingProgress,
  selectionSearchProgress
} from '../src/loading-progress.js';

describe('normalizeLoadingProgress', () => {
  it('returns a bounded percentage for measurable work', () => {
    expect(normalizeLoadingProgress({ value: 42.6 })).toEqual({
      value: 43,
      label: '43 %'
    });
    expect(normalizeLoadingProgress({ value: 130 }).value).toBe(100);
  });

  it('keeps work indeterminate when no honest percentage is available', () => {
    expect(normalizeLoadingProgress({ indeterminate: true })).toEqual({
      value: null,
      label: 'En cours'
    });
  });
});

describe('selectionSearchProgress', () => {
  it('maps scanned pages to the search portion of the overall progress', () => {
    expect(selectionSearchProgress(0, 100)).toBe(8);
    expect(selectionSearchProgress(50, 100)).toBe(39);
    expect(selectionSearchProgress(100, 100)).toBe(70);
  });
});
