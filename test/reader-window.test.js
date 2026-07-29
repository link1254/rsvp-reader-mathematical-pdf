import { describe, expect, it, vi } from 'vitest';
import {
  findHorizontalReaderWindow,
  focusHorizontalReaderWindow,
  isHorizontalReaderWindow
} from '../src/reader-window.js';

const readerUrl = 'chrome-extension://reader/src/sidepanel.html?layout=horizontal';

describe('reader window reuse', () => {
  it('recognizes only the horizontal reader page', () => {
    expect(isHorizontalReaderWindow({
      tabs: [{ url: readerUrl }]
    }, readerUrl)).toBe(true);
    expect(isHorizontalReaderWindow({
      tabs: [{ url: 'chrome-extension://reader/src/sidepanel.html' }]
    }, readerUrl)).toBe(false);
    expect(isHorizontalReaderWindow({
      tabs: [{ url: 'https://example.com/document.pdf' }]
    }, readerUrl)).toBe(false);
  });

  it('finds an existing reader popup after the service worker restarts', async () => {
    const windowsApi = {
      getAll: vi.fn().mockResolvedValue([
        { id: 7, tabs: [{ url: 'https://example.com/document.pdf' }] },
        { id: 12, tabs: [{ url: readerUrl }] }
      ])
    };

    await expect(findHorizontalReaderWindow(windowsApi, readerUrl))
      .resolves.toMatchObject({ id: 12 });
    expect(windowsApi.getAll).toHaveBeenCalledWith({
      populate: true,
      windowTypes: ['popup']
    });
  });

  it('focuses the existing reader instead of creating another window', async () => {
    const windowsApi = {
      getAll: vi.fn().mockResolvedValue([
        { id: 12, tabs: [{ url: readerUrl }] }
      ]),
      update: vi.fn().mockResolvedValue({ id: 12 })
    };

    await expect(focusHorizontalReaderWindow(windowsApi, readerUrl))
      .resolves.toBe(12);
    expect(windowsApi.update).toHaveBeenCalledWith(12, { focused: true });
  });

  it('returns null when no reader window is open', async () => {
    const windowsApi = {
      getAll: vi.fn().mockResolvedValue([
        { id: 7, tabs: [{ url: 'https://example.com/document.pdf' }] }
      ]),
      update: vi.fn()
    };

    await expect(focusHorizontalReaderWindow(windowsApi, readerUrl))
      .resolves.toBeNull();
    expect(windowsApi.update).not.toHaveBeenCalled();
  });
});
