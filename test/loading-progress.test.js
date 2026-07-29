import { describe, expect, it } from 'vitest';
import {
  detectionStageProgress,
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
    expect(normalizeLoadingProgress({
      indeterminate: true,
      label: '12 Mo chargés'
    })).toEqual({
      value: null,
      label: '12 Mo chargés'
    });
  });

  it('preserves a more informative stage label', () => {
    expect(normalizeLoadingProgress({
      value: 88,
      label: '100 % · 80/80 Mo'
    })).toEqual({
      value: 88,
      label: '100 % · 80/80 Mo'
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

describe('detectionStageProgress', () => {
  it('maps real model bytes into the model-loading segment', () => {
    expect(detectionStageProgress('model-download', {
      loaded: 40 * 1_048_576,
      total: 80 * 1_048_576
    })).toEqual({
      value: 82.5,
      label: '50 % · 40/80 Mo'
    });
  });

  it('shows elapsed activity without claiming a model percentage', () => {
    expect(detectionStageProgress('model-compile', { elapsedMs: 2000 }))
      .toEqual({
        value: 89.5,
        label: '2 s écoulées'
      });
    expect(detectionStageProgress('inference', { elapsedMs: 1500 }))
      .toEqual({
        value: 93,
        label: '1 s écoulées'
      });
  });

  it('keeps all model phases monotonic', () => {
    const values = [
      detectionStageProgress('preparing').value,
      detectionStageProgress('queued').value,
      detectionStageProgress('model-download', {
        loaded: 80,
        total: 80
      }).value,
      detectionStageProgress('model-ready').value,
      detectionStageProgress('inference', { elapsedMs: 0 }).value,
      detectionStageProgress('postprocess').value
    ];

    expect(values).toEqual([...values].sort((left, right) => left - right));
  });
});
