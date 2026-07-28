export const FEEDBACK_CATEGORIES = Object.freeze([
  'equation',
  'selection',
  'playback',
  'interface',
  'other'
]);

function clipped(value, maximum) {
  const normalized = String(value || '').trim();
  if (normalized.length <= maximum) return normalized;
  return `${normalized.slice(0, maximum - 1)}…`;
}

function imageByteSize(dataUrl) {
  if (!dataUrl) return 0;
  const encoded = String(dataUrl).split(',', 2)[1] || '';
  return Math.floor(encoded.length * 3 / 4);
}

function documentName(sourceUrl) {
  if (!sourceUrl) return null;
  try {
    const url = new URL(sourceUrl);
    const name = decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) || '');
    return name && !/^(?:index|edge_pdf)\.html?$/i.test(name) ? name : null;
  } catch {
    return null;
  }
}

export function buildFeedbackReport(input, limits = {}) {
  const maxDescriptionCharacters = limits.maxDescriptionCharacters || 1500;
  const maxExcerptCharacters = limits.maxExcerptCharacters || 2500;
  const maxPageImageBytes = limits.maxPageImageBytes || 8 * 1024 * 1024;
  const description = clipped(input.description, maxDescriptionCharacters);
  if (!description) throw new Error('Décrivez le problème avant de préparer le rapport.');

  const category = FEEDBACK_CATEGORIES.includes(input.category)
    ? input.category
    : 'other';
  const pageImage = input.includePageImage ? input.pageCapture || null : null;
  if (pageImage && imageByteSize(pageImage) > maxPageImageBytes) {
    throw new Error('L’image de la page est trop volumineuse pour être jointe.');
  }

  const report = {
    schemaVersion: 1,
    reportId: input.reportId || globalThis.crypto?.randomUUID?.() || `feedback-${Date.now()}`,
    createdAt: input.createdAt || new Date().toISOString(),
    category,
    description,
    diagnostics: {
      extensionVersion: String(input.extensionVersion || 'unknown'),
      browser: clipped(input.browser, 300),
      pageNumber: Number.isInteger(input.pageNumber) ? input.pageNumber : null,
      readingPosition: Number.isInteger(input.itemIndex) ? input.itemIndex + 1 : null,
      readingItems: Number.isInteger(input.itemCount) ? input.itemCount : null,
      equationCount: Number.isInteger(input.equationCount) ? input.equationCount : null,
      unresolvedEquationCount: Number.isInteger(input.unresolvedEquationCount)
        ? input.unresolvedEquationCount
        : null,
      documentName: documentName(input.sourceUrl)
    }
  };
  if (input.includeExcerpt) {
    report.selectionExcerpt = clipped(input.selectionText, maxExcerptCharacters);
  }
  if (pageImage) report.pageImage = pageImage;
  return report;
}

export function formatFeedbackReport(report) {
  const diagnostics = report.diagnostics || {};
  const lines = [
    `# RSVP Reader feedback: ${report.category}`,
    '',
    report.description,
    '',
    '## Diagnostics',
    `- Version: ${diagnostics.extensionVersion || 'unknown'}`,
    `- Page PDF: ${diagnostics.pageNumber ?? 'unknown'}`,
    `- Position: ${diagnostics.readingPosition ?? 'unknown'} / ${diagnostics.readingItems ?? 'unknown'}`,
    `- Équations: ${diagnostics.equationCount ?? 'unknown'} (${diagnostics.unresolvedEquationCount ?? 'unknown'} non résolues)`,
    `- Document: ${diagnostics.documentName || 'non transmis'}`,
    `- Navigateur: ${diagnostics.browser || 'unknown'}`
  ];
  if (report.selectionExcerpt) {
    lines.push('', '## Extrait sélectionné', report.selectionExcerpt);
  }
  lines.push('', `Image de la page jointe: ${report.pageImage ? 'oui' : 'non'}`);
  return lines.join('\n');
}

export function feedbackEndpoint(endpoint) {
  if (!endpoint) return null;
  const url = new URL(endpoint);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) {
    throw new Error('Le relais de feedback doit utiliser HTTPS.');
  }
  return url.href;
}

export function publicIssueEndpoint(endpoint) {
  const url = new URL(endpoint);
  const validPath = /^\/[^/]+\/[^/]+\/issues\/new\/?$/.test(url.pathname);
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || !validPath) {
    throw new Error('L’adresse de signalement public doit être une page de nouvelle Issue GitHub.');
  }
  return url.href;
}

export function publicFeedbackIssueUrl(report, endpoint) {
  const url = new URL(publicIssueEndpoint(endpoint));
  const publicReport = { ...report };
  delete publicReport.pageImage;
  const summary = report.description.replace(/\s+/g, ' ').trim();
  url.searchParams.set('title', `[Feedback ${report.category}] ${clipped(summary, 90)}`);
  url.searchParams.set('body', formatFeedbackReport(publicReport));
  return url.href;
}

export async function submitFeedbackReport(report, endpoint, fetchImpl = fetch) {
  const url = feedbackEndpoint(endpoint);
  if (!url) throw new Error('L’envoi privé n’est pas encore configuré.');
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'omit',
    body: JSON.stringify(report)
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Le relais a refusé le rapport (${response.status}).`);
  }
  return response.json().catch(() => ({}));
}
