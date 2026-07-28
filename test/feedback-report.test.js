import { describe, expect, it, vi } from 'vitest';
import {
  buildFeedbackReport,
  feedbackEndpoint,
  formatFeedbackReport,
  publicFeedbackIssueUrl,
  publicIssueEndpoint,
  submitFeedbackReport
} from '../src/feedback-report.js';

const baseInput = {
  reportId: 'report-1',
  createdAt: '2026-07-27T12:00:00.000Z',
  category: 'equation',
  description: 'La première équation manque.',
  extensionVersion: '0.15.21',
  browser: 'Edge test',
  pageNumber: 23,
  itemIndex: 4,
  itemCount: 80,
  equationCount: 5,
  unresolvedEquationCount: 1,
  sourceUrl: 'file:///C:/Cours/notes%20QFT.pdf',
  selectionText: 'A long selected passage',
  pageCapture: 'data:image/png;base64,aGVsbG8='
};

describe('feedback report', () => {
  it('includes only data explicitly authorized by the user', () => {
    const report = buildFeedbackReport({
      ...baseInput,
      includeExcerpt: false,
      includePageImage: false
    });

    expect(report.selectionExcerpt).toBeUndefined();
    expect(report.pageImage).toBeUndefined();
    expect(report.diagnostics.documentName).toBe('notes QFT.pdf');
    expect(JSON.stringify(report)).not.toContain('C:/Cours');
  });

  it('includes the excerpt and page image after explicit consent', () => {
    const report = buildFeedbackReport({
      ...baseInput,
      includeExcerpt: true,
      includePageImage: true
    });

    expect(report.selectionExcerpt).toBe(baseInput.selectionText);
    expect(report.pageImage).toBe(baseInput.pageCapture);
  });

  it('rejects an empty description and oversized page image', () => {
    expect(() => buildFeedbackReport({ ...baseInput, description: ' ' })).toThrow();
    expect(() => buildFeedbackReport({
      ...baseInput,
      includePageImage: true,
      pageCapture: `data:image/png;base64,${'a'.repeat(100)}`
    }, { maxPageImageBytes: 10 })).toThrow(/volumineuse/);
  });

  it('formats a readable report without exposing image data', () => {
    const report = buildFeedbackReport({
      ...baseInput,
      includeExcerpt: true,
      includePageImage: true
    });
    const formatted = formatFeedbackReport(report);

    expect(formatted).toContain('La première équation manque.');
    expect(formatted).toContain('Page PDF: 23');
    expect(formatted).toContain('Image de la page jointe: oui');
    expect(formatted).not.toContain('aGVsbG8=');
  });

  it('requires HTTPS except for a local development relay', () => {
    expect(feedbackEndpoint('https://feedback.example.test/report')).toBe(
      'https://feedback.example.test/report'
    );
    expect(feedbackEndpoint('http://127.0.0.1:8787/report')).toBe(
      'http://127.0.0.1:8787/report'
    );
    expect(() => feedbackEndpoint('http://example.test/report')).toThrow(/HTTPS/);
  });

  it('builds a prefilled public GitHub Issue without image data', () => {
    const report = buildFeedbackReport({
      ...baseInput,
      includeExcerpt: true,
      includePageImage: true
    });
    const issueUrl = new URL(publicFeedbackIssueUrl(
      report,
      'https://github.com/link1254/rsvp-reader-mathematical-pdf/issues/new'
    ));

    expect(issueUrl.origin).toBe('https://github.com');
    expect(issueUrl.pathname).toBe('/link1254/rsvp-reader-mathematical-pdf/issues/new');
    expect(issueUrl.searchParams.get('title')).toContain('[Feedback equation]');
    expect(issueUrl.searchParams.get('body')).toContain(baseInput.selectionText);
    expect(issueUrl.searchParams.get('body')).toContain('Image de la page jointe: non');
    expect(issueUrl.href).not.toContain('aGVsbG8');
  });

  it('accepts only a GitHub new-Issue page for public reports', () => {
    expect(publicIssueEndpoint(
      'https://github.com/link1254/rsvp-reader-mathematical-pdf/issues/new'
    )).toBe('https://github.com/link1254/rsvp-reader-mathematical-pdf/issues/new');
    expect(() => publicIssueEndpoint('https://example.test/issues/new')).toThrow(/GitHub/);
    expect(() => publicIssueEndpoint(
      'https://github.com/link1254/rsvp-reader-mathematical-pdf/issues'
    )).toThrow(/GitHub/);
  });

  it('posts a report to the configured private relay', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reportId: 'private-42' })
    });
    const report = buildFeedbackReport(baseInput);

    await expect(submitFeedbackReport(
      report,
      'https://feedback.example.test/report',
      fetchImpl
    )).resolves.toEqual({ reportId: 'private-42' });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://feedback.example.test/report',
      expect.objectContaining({ method: 'POST', credentials: 'omit' })
    );
  });

  it('does not attempt an upload without a configured relay', async () => {
    const fetchImpl = vi.fn();

    await expect(submitFeedbackReport({}, '', fetchImpl)).rejects.toThrow(/pas encore configuré/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
