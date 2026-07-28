import { describe, expect, it } from 'vitest';
import { normalizeFeedbackMode } from '../src/feedback-config.js';

describe('feedback configuration', () => {
  it('uses public reporting by default', () => {
    expect(normalizeFeedbackMode('', '')).toBe('public');
  });

  it('supports public, private and disabled modes', () => {
    expect(normalizeFeedbackMode('public')).toBe('public');
    expect(normalizeFeedbackMode('private')).toBe('private');
    expect(normalizeFeedbackMode('disabled')).toBe('disabled');
  });

  it('keeps the legacy disabled setting and rejects unknown modes safely', () => {
    expect(normalizeFeedbackMode('', 'false')).toBe('disabled');
    expect(normalizeFeedbackMode('unexpected')).toBe('disabled');
  });
});
