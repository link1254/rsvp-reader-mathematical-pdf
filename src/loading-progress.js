import { t } from './i18n.js';

export function normalizeLoadingProgress(details = {}) {
  if (details.indeterminate || !Number.isFinite(details.value)) {
    return { value: null, label: t('inProgress') };
  }

  const value = Math.max(0, Math.min(100, Math.round(details.value)));
  return { value, label: `${value} %` };
}

export function selectionSearchProgress(completedPages, totalPages) {
  if (!Number.isFinite(totalPages) || totalPages <= 0) return 8;
  const completed = Math.max(0, Math.min(totalPages, completedPages));
  return 8 + (completed / totalPages) * 62;
}
