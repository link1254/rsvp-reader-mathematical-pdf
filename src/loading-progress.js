import { t } from './i18n.js';

export function normalizeLoadingProgress(details = {}) {
  if (details.indeterminate || !Number.isFinite(details.value)) {
    return { value: null, label: details.label || t('inProgress') };
  }

  const value = Math.max(0, Math.min(100, Math.round(details.value)));
  return { value, label: details.label || `${value} %` };
}

export function selectionSearchProgress(completedPages, totalPages) {
  if (!Number.isFinite(totalPages) || totalPages <= 0) return 8;
  const completed = Math.max(0, Math.min(totalPages, completedPages));
  return 8 + (completed / totalPages) * 62;
}

function megabytes(bytes) {
  return Math.max(0, Math.round(Number(bytes || 0) / 1_048_576));
}

function elapsedStageValue(start, end, elapsedMs, durationMs) {
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  const ratio = Math.min(.92, elapsed / durationMs);
  return start + (end - start) * ratio;
}

export function detectionStageProgress(stage, details = {}) {
  if (stage === 'preparing') return { value: 76 };
  if (stage === 'queued') return { value: 77 };

  if (stage === 'model-download') {
    const loaded = Math.max(0, Number(details.loaded) || 0);
    const total = Number(details.total);
    if (Number.isFinite(total) && total > 0) {
      const ratio = Math.max(0, Math.min(1, loaded / total));
      return {
        value: 77 + ratio * 11,
        label: t('modelDownloadProgress', {
          percent: Math.round(ratio * 100),
          loaded: megabytes(loaded),
          total: megabytes(total)
        })
      };
    }
    return {
      indeterminate: true,
      label: t('modelDownloadedSize', { loaded: megabytes(loaded) })
    };
  }

  if (stage === 'model-compile') {
    return {
      value: elapsedStageValue(88, 91, details.elapsedMs, 4000),
      label: t('elapsedTime', {
        seconds: Math.floor(Math.max(0, Number(details.elapsedMs) || 0) / 1000)
      })
    };
  }
  if (stage === 'model-ready') return { value: 91 };
  if (stage === 'inference') {
    return {
      value: elapsedStageValue(92, 94, details.elapsedMs, 3000),
      label: t('elapsedTime', {
        seconds: Math.floor(Math.max(0, Number(details.elapsedMs) || 0) / 1000)
      })
    };
  }
  if (stage === 'postprocess') return { value: 95 };
  return { indeterminate: true };
}
