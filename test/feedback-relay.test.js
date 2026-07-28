import { afterEach, describe, expect, it, vi } from 'vitest';
import relay, { issueBody, validateReport } from '../feedback-relay/worker.mjs';

const report = {
  reportId: 'report-1234',
  createdAt: '2026-07-27T12:00:00.000Z',
  category: 'equation',
  description: 'Equation missing',
  diagnostics: {
    extensionVersion: '0.15.21',
    browser: 'Edge',
    pageNumber: 23,
    readingPosition: 1,
    readingItems: 50,
    equationCount: 4,
    unresolvedEquationCount: 1,
    documentName: 'notes.pdf'
  },
  selectionExcerpt: 'Selected text'
};

describe('private feedback relay', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('validates and limits the report received from the extension', () => {
    const validated = validateReport(report);

    expect(validated.reportId).toBe('report-1234');
    expect(validated.description).toBe('Equation missing');
    expect(validated.diagnostics.pageNumber).toBe(23);
  });

  it('rejects invalid image attachments', () => {
    expect(() => validateReport({
      ...report,
      pageImage: 'data:text/plain;base64,aGVsbG8='
    })).toThrow(/PNG/);
  });

  it('builds a private issue body without embedding image data', () => {
    const body = issueBody(validateReport(report), 'https://github.com/private/page.png');

    expect(body).toContain('Equation missing');
    expect(body).toContain('Selected text');
    expect(body).toContain('https://github.com/private/page.png');
    expect(body).not.toContain('data:image');
  });

  it('refuses an origin outside the configured extension list', async () => {
    const response = await relay.fetch(new Request('https://relay.example.test', {
      method: 'POST',
      headers: { Origin: 'https://untrusted.example.test' },
      body: JSON.stringify(report)
    }), {
      ALLOWED_ORIGINS: 'chrome-extension://trusted'
    });

    expect(response.status).toBe(403);
  });

  it('stores an optional page and creates an issue in the private repository', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        content: { html_url: 'https://github.com/private/reports/report-1234/page.png' }
      }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ number: 42 }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await relay.fetch(new Request('https://relay.example.test', {
      method: 'POST',
      headers: {
        Origin: 'chrome-extension://trusted',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...report,
        pageImage: 'data:image/png;base64,aGVsbG8='
      })
    }), {
      ALLOWED_ORIGINS: 'chrome-extension://trusted',
      GITHUB_TOKEN: 'server-only-token',
      GITHUB_OWNER: 'link1254',
      GITHUB_REPOSITORY: 'private-reports',
      GITHUB_BRANCH: 'main'
    });
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload).toEqual({ reportId: 'report-1234', issueNumber: 42 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('/contents/reports/report-1234/page.png');
    expect(fetchMock.mock.calls[1][0]).toContain('/issues');
    expect(fetchMock.mock.calls[1][1].body).not.toContain('aGVsbG8=');
  });
});
