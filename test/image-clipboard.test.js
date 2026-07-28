import { describe, expect, it, vi } from 'vitest';
import { copyPngDataUrl } from '../src/image-clipboard.js';

const PNG_DATA_URL = 'data:image/png;base64,AA==';

describe('copyPngDataUrl', () => {
  it('writes the PNG capture as a clipboard image', async () => {
    const png = new Blob(['png'], { type: 'image/png' });
    const clipboard = { write: vi.fn(async () => {}) };
    const createdItems = [];
    class ClipboardItemMock {
      constructor(content) {
        this.content = content;
        createdItems.push(this);
      }
    }

    await copyPngDataUrl(PNG_DATA_URL, {
      clipboard,
      ClipboardItemCtor: ClipboardItemMock,
      fetchImpl: vi.fn(async () => ({ blob: async () => png }))
    });

    expect(clipboard.write).toHaveBeenCalledWith(createdItems);
    expect(createdItems[0].content['image/png']).toBe(png);
  });

  it('refuses a non-PNG data URL', async () => {
    await expect(copyPngDataUrl('data:image/jpeg;base64,AA=='))
      .rejects.toThrow('image PNG');
  });

  it('reports an unavailable clipboard API', async () => {
    await expect(copyPngDataUrl(PNG_DATA_URL, {
      clipboard: {},
      ClipboardItemCtor: class {},
      fetchImpl: vi.fn()
    })).rejects.toThrow('pas disponible');
  });
});
