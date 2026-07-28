const GITHUB_API_VERSION = '2026-03-10';
const MAX_REQUEST_BYTES = 12 * 1024 * 1024;
const MAX_DESCRIPTION_CHARACTERS = 1500;
const MAX_EXCERPT_CHARACTERS = 2500;

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  if (allowed.length && !allowed.includes(origin)) return null;
  return {
    'Access-Control-Allow-Origin': allowed.length ? origin : '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}

function jsonResponse(payload, status, headers) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

function cleanText(value, maximum) {
  return String(value || '').trim().slice(0, maximum);
}

function validateReport(value) {
  if (!value || typeof value !== 'object') throw new Error('Rapport JSON invalide.');
  const description = cleanText(value.description, MAX_DESCRIPTION_CHARACTERS);
  if (!description) throw new Error('Description manquante.');
  if (value.pageImage
    && !/^data:image\/png;base64,[a-z0-9+/=\s]+$/i.test(value.pageImage)) {
    throw new Error('La page jointe doit être une image PNG.');
  }
  return {
    schemaVersion: 1,
    reportId: /^[a-z0-9-]{8,80}$/i.test(value.reportId || '')
      ? value.reportId
      : crypto.randomUUID(),
    createdAt: cleanText(value.createdAt, 80),
    category: cleanText(value.category, 40) || 'other',
    description,
    diagnostics: {
      extensionVersion: cleanText(value.diagnostics?.extensionVersion, 40),
      browser: cleanText(value.diagnostics?.browser, 300),
      pageNumber: Number.isInteger(value.diagnostics?.pageNumber)
        ? value.diagnostics.pageNumber
        : null,
      readingPosition: Number.isInteger(value.diagnostics?.readingPosition)
        ? value.diagnostics.readingPosition
        : null,
      readingItems: Number.isInteger(value.diagnostics?.readingItems)
        ? value.diagnostics.readingItems
        : null,
      equationCount: Number.isInteger(value.diagnostics?.equationCount)
        ? value.diagnostics.equationCount
        : null,
      unresolvedEquationCount: Number.isInteger(value.diagnostics?.unresolvedEquationCount)
        ? value.diagnostics.unresolvedEquationCount
        : null,
      documentName: cleanText(value.diagnostics?.documentName, 240)
    },
    selectionExcerpt: cleanText(value.selectionExcerpt, MAX_EXCERPT_CHARACTERS) || null,
    pageImage: value.pageImage || null
  };
}

function safeCodeBlock(value) {
  return String(value || '').replaceAll('```', '``\u200b`');
}

function issueBody(report, pageUrl = null) {
  const diagnostics = report.diagnostics;
  const lines = [
    `**Report ID:** \`${report.reportId}\``,
    `**Created:** ${report.createdAt || 'unknown'}`,
    `**Extension:** ${diagnostics.extensionVersion || 'unknown'}`,
    `**PDF page:** ${diagnostics.pageNumber ?? 'unknown'}`,
    `**Reading position:** ${diagnostics.readingPosition ?? 'unknown'} / ${diagnostics.readingItems ?? 'unknown'}`,
    `**Equations:** ${diagnostics.equationCount ?? 'unknown'} (${diagnostics.unresolvedEquationCount ?? 'unknown'} unresolved)`,
    `**Document:** ${diagnostics.documentName || 'not provided'}`,
    `**Browser:** ${diagnostics.browser || 'unknown'}`,
    '',
    '## Description',
    safeCodeBlock(report.description)
  ];
  if (report.selectionExcerpt) {
    lines.push(
      '',
      '## Selected excerpt',
      '```text',
      safeCodeBlock(report.selectionExcerpt),
      '```'
    );
  }
  if (pageUrl) lines.push('', '## Private page capture', pageUrl);
  return lines.join('\n');
}

async function githubRequest(env, path, options) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'rsvp-reader-feedback-relay',
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
      ...options.headers
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${payload.message || 'request failed'}`);
  }
  return payload;
}

async function storePageImage(env, report) {
  if (!report.pageImage) return null;
  const base64 = report.pageImage.slice(report.pageImage.indexOf(',') + 1).replace(/\s/g, '');
  const path = `reports/${report.reportId}/page.png`;
  const payload = await githubRequest(
    env,
    `/repos/${encodeURIComponent(env.GITHUB_OWNER)}/${encodeURIComponent(env.GITHUB_REPOSITORY)}/contents/${path}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        message: `Add private feedback capture ${report.reportId}`,
        content: base64,
        branch: env.GITHUB_BRANCH || undefined
      })
    }
  );
  return payload.content?.html_url || null;
}

async function createPrivateIssue(env, report, pageUrl) {
  const titleText = report.description.replace(/\s+/g, ' ').slice(0, 90);
  return githubRequest(
    env,
    `/repos/${encodeURIComponent(env.GITHUB_OWNER)}/${encodeURIComponent(env.GITHUB_REPOSITORY)}/issues`,
    {
      method: 'POST',
      body: JSON.stringify({
        title: `[${report.category}] ${titleText}`,
        body: issueBody(report, pageUrl)
      })
    }
  );
}

export default {
  async fetch(request, env) {
    const headers = corsHeaders(request, env);
    if (!headers) return jsonResponse({ error: 'Origine refusée.' }, 403, {});
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Méthode non autorisée.' }, 405, headers);
    }
    if (!env.GITHUB_TOKEN || !env.GITHUB_OWNER || !env.GITHUB_REPOSITORY) {
      return jsonResponse({ error: 'Relais privé non configuré.' }, 503, headers);
    }
    const declaredLength = Number(request.headers.get('Content-Length') || 0);
    if (declaredLength > MAX_REQUEST_BYTES) {
      return jsonResponse({ error: 'Rapport trop volumineux.' }, 413, headers);
    }

    try {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) {
        return jsonResponse({ error: 'Rapport trop volumineux.' }, 413, headers);
      }
      const report = validateReport(JSON.parse(raw));
      const pageUrl = await storePageImage(env, report);
      const issue = await createPrivateIssue(env, report, pageUrl);
      return jsonResponse({
        reportId: report.reportId,
        issueNumber: issue.number
      }, 201, headers);
    } catch (error) {
      console.error('Private feedback relay failure', error);
      const clientError = error instanceof SyntaxError || /invalide|manquante|doit être/.test(error.message);
      return jsonResponse({
        error: clientError ? error.message : 'Le rapport privé n’a pas pu être enregistré.'
      }, clientError ? 400 : 502, headers);
    }
  }
};

export { issueBody, validateReport };
