export function normalizeFeedbackMode(mode, legacyEnabled) {
  const normalized = String(mode || '').trim().toLowerCase();
  if (['public', 'private', 'disabled'].includes(normalized)) return normalized;
  if (normalized) return 'disabled';
  if (String(legacyEnabled || '').trim().toLowerCase() === 'false') return 'disabled';
  return 'public';
}

const mode = normalizeFeedbackMode(
  import.meta.env.VITE_FEEDBACK_MODE,
  import.meta.env.VITE_FEEDBACK_ENABLED
);

export const FEEDBACK_CONFIG = Object.freeze({
  mode,
  enabled: mode !== 'disabled',
  publicIssueUrl: (
    import.meta.env.VITE_FEEDBACK_PUBLIC_ISSUE_URL
    || 'https://github.com/link1254/rsvp-reader-mathematical-pdf/issues/new'
  ).trim(),
  endpoint: (import.meta.env.VITE_FEEDBACK_ENDPOINT || '').trim(),
  maxDescriptionCharacters: 1500,
  maxExcerptCharacters: 2500,
  maxPageImageBytes: 8 * 1024 * 1024
});
