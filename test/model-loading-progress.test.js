import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  MODEL_SIZE_BYTES,
  responseArrayBufferWithProgress
} from '../src/math-region-detector.js';

function responseFromChunks(chunks, total = null) {
  let index = 0;
  return {
    headers: {
      get: name => name === 'content-length' && total !== null
        ? String(total)
        : null
    },
    body: {
      getReader: () => ({
        read: async () => index < chunks.length
          ? { done: false, value: chunks[index++] }
          : { done: true }
      })
    }
  };
}

describe('model loading progress', () => {
  it('does not run a blocked elapsed-time chronometer', () => {
    const source = readFileSync(
      new URL('../src/math-region-detector.js', import.meta.url),
      'utf8'
    );

    expect(source).not.toContain('setInterval');
    expect(source).not.toContain('elapsedMs');
  });

  it('keeps the packaged model size fallback accurate', () => {
    const model = statSync(
      new URL('../public/models/pix2text-mfd-1.5.onnx', import.meta.url)
    );

    expect(model.size).toBe(MODEL_SIZE_BYTES);
  });

  it('reports streamed bytes and reconstructs the model buffer', async () => {
    const onProgress = vi.fn();
    const buffer = await responseArrayBufferWithProgress(
      responseFromChunks([
        new Uint8Array([1, 2]),
        new Uint8Array([3, 4, 5])
      ], 5),
      onProgress
    );

    expect([...new Uint8Array(buffer)]).toEqual([1, 2, 3, 4, 5]);
    expect(onProgress.mock.calls.map(([progress]) => progress))
      .toEqual([
        { loaded: 0, total: 5 },
        { loaded: 2, total: 5 },
        { loaded: 5, total: 5 }
      ]);
  });

  it('still reports loaded megabytes when content length is unavailable', async () => {
    const onProgress = vi.fn();
    await responseArrayBufferWithProgress(
      responseFromChunks([new Uint8Array(1_048_576)]),
      onProgress
    );

    expect(onProgress).toHaveBeenLastCalledWith({
      loaded: 1_048_576,
      total: null
    });
  });

  it('uses the verified packaged size when Edge hides content length', async () => {
    const onProgress = vi.fn();
    await responseArrayBufferWithProgress(
      responseFromChunks([new Uint8Array([1, 2, 3])]),
      onProgress,
      3
    );

    expect(onProgress).toHaveBeenLastCalledWith({
      loaded: 3,
      total: 3
    });
  });
});
