import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(
  new URL('../src/sidepanel.html', import.meta.url),
  'utf8'
);
const source = readFileSync(
  new URL('../src/sidepanel.js', import.meta.url),
  'utf8'
);
const stylesheet = readFileSync(
  new URL('../src/sidepanel.css', import.meta.url),
  'utf8'
);
const manifest = JSON.parse(
  readFileSync(new URL('../manifest.json', import.meta.url), 'utf8')
);

describe('synchronized speech controls', () => {
  it('is optional, local, and disabled by default', () => {
    expect(manifest.permissions).toContain('tts');
    expect(html).toContain('id="speechEnabled" type="checkbox"');
    expect(html).toContain('id="speechVoice"');
    expect(source).toContain('speechEnabled: false');
    expect(source).toContain('localSpeechVoices(speechVoices)');
  });

  it('synchronizes the visible item from word boundary events', () => {
    expect(source).toContain("event.type === 'word'");
    expect(source).toContain('speechItemIndexAtBoundary(chunk.entries, event.charIndex)');
    expect(source).toContain('rate: speechRateFromWpm(state.wpm)');
    expect(source).toContain("desiredEventTypes: ['start', 'word', 'end', 'error']");
    expect(source).toContain('scheduleSpeechFallback(runId, chunk)');
  });

  it('stops speech on pause and persists both audio settings', () => {
    expect(source).toMatch(/function pause\(\)[\s\S]+stopSpeechPlayback\(\)/);
    expect(source).toContain("window.addEventListener('pagehide', stopSpeechPlayback)");
    expect(source).toContain('speechEnabled: state.speechEnabled');
    expect(source).toContain('speechVoiceName: state.speechVoiceName');
    expect(source).toContain("$('#speechEnabled').onchange");
    expect(source).toContain("$('#speechVoice').onchange");
    expect(stylesheet).toContain('.speech-setting{display:grid');
  });
});
