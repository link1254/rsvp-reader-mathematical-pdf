import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { t } from './i18n.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

function joinPageItems(items) {
  const rows = new Map();
  for (const item of items) {
    if (!item.str?.trim()) continue;
    const y = Math.round(item.transform[5] / 3) * 3;
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y).push({ text: item.str, x: item.transform[4], width: item.width, height: item.height, font: item.fontName });
  }
  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, row]) => {
      row.sort((a, b) => a.x - b.x);
      let line = '';
      let previousEnd = -Infinity;
      for (const part of row) {
        const gap = part.x - previousEnd;
        const needsSpace = line && gap > Math.max(1.5, part.height * 0.12) && !/[-(/]$/.test(line) && !/^[,.;:!?)]/.test(part.text);
        line += (needsSpace ? ' ' : '') + part.text;
        previousEnd = part.x + part.width;
      }
      return line.trim();
    })
    .filter(Boolean)
    .join('\n');
}

export async function extractPdf(source, onProgress = () => {}) {
  const loadingTask = pdfjsLib.getDocument(source);
  const pdf = await loadingTask.promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent({ includeMarkedContent: true, disableNormalization: false });
    pages.push(joinPageItems(content.items));
    onProgress(pageNumber, pdf.numPages);
  }
  const metadata = await pdf.getMetadata().catch(() => ({ info: {} }));
  return {
    text: pages.join('\n\n'),
    pages: pdf.numPages,
    title: metadata.info?.Title || t('scientificDocument')
  };
}
