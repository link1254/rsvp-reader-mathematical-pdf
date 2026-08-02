import { describe, expect, it } from 'vitest';
import {
  localPdfBytes,
  localPdfFileName,
  localPdfKey,
  matchesLocalPdfFile
} from '../src/local-pdf.js';

const pdfUrl = 'file:///C:/Documents/My%20Physics%20Course.pdf#page=19';

describe('Firefox local PDF fallback', () => {
  it('normalizes a local PDF cache key without its page fragment', () => {
    expect(localPdfKey(pdfUrl))
      .toBe('file:///C:/Documents/My%20Physics%20Course.pdf');
    expect(localPdfKey('https://example.com/course.pdf')).toBeNull();
  });

  it('extracts and compares the expected PDF filename', () => {
    expect(localPdfFileName(pdfUrl)).toBe('My Physics Course.pdf');
    expect(matchesLocalPdfFile({ name: 'my physics course.PDF' }, pdfUrl)).toBe(true);
    expect(matchesLocalPdfFile({ name: 'another.pdf' }, pdfUrl)).toBe(false);
  });

  it('accepts typed arrays and array buffers as PDF data', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    expect(localPdfBytes({ pdfData: bytes })).toBe(bytes);
    expect([...localPdfBytes({ pdfData: bytes.buffer })]).toEqual([1, 2, 3]);
    expect(localPdfBytes({})).toBeNull();
  });
});
