import {
  normalizeAdaptivePacing,
  parseEquationLabel,
  playbackAction,
  readingDelay,
  replaySentenceIndex,
  sentenceBounds
} from './selection-engine.js';
import { orpIndex } from './text-engine.js';
import { cropCaptureRect } from './equation-image.js';
import { renderVisualSelectionFromPdf } from './pdf-equation-image.js';
import { copyPngDataUrl } from './image-clipboard.js';
import { normalizeLoadingProgress } from './loading-progress.js';
import {
  applyReaderFont,
  normalizeReaderFont
} from './reader-fonts.js';
import {
  applyReaderTheme,
  normalizeReaderTheme
} from './reader-themes.js';
import { normalizeOverviewMathMode } from './overview-display.js';
import {
  equationContentScale,
  equationSnapshotWidth,
  horizontalContextLaneWidth,
  normalizeEquationImageSize,
  readerContentScale
} from './window-layout.js';
import { initializeFeedback } from './feedback-ui.js';
import {
  applyDocumentTranslations,
  getUiLanguage,
  normalizeUiLanguagePreference,
  setUiLanguage,
  t
} from './i18n.js';
import {
  AUTOMATIC_SPEECH_VOICE,
  availableSpeechVoices,
  buildSpeechChunk,
  detectSpeechLocale,
  isMicrosoftAriaNaturalVoice,
  localSpeechVoices,
  selectSpeechVoice,
  speechItemIndexAtBoundary,
  speechRateFromWpm
} from './speech-playback.js';
import { createSpeechPlaybackApi } from './speech-api.js';

const api = globalThis.browser ?? globalThis.chrome;
const speechApi = createSpeechPlaybackApi({
  chromeTts: api?.tts,
  speechSynthesis: globalThis.speechSynthesis,
  SpeechSynthesisUtterance: globalThis.SpeechSynthesisUtterance
});
const extensionStorage = api?.storage?.local ?? {
  get: async () => ({}),
  set: async () => {}
};
const $ = selector => document.querySelector(selector);
const state = { items: [], index: 0, playing: false, timer: null, wpm: 300, equationMode: 'manual', adaptivePacing: 'normal', contextSize: 3, horizontalContext: false, overviewMathMode: 'labels', speechEnabled: false, speechVoiceName: AUTOMATIC_SPEECH_VOICE, fontSize: 62, equationImageSize: 100, readerFont: 'system', readerTheme: 'classic', uiLanguage: 'auto', equationImages: {}, equationImagePixelRatios: {}, equationLookupComplete: false, pageCapture: null, pageNumber: null, selectionPayload: null, cropRect: null };
let selectionLoadId = 0;
let selectionAbortController = null;
let feedbackController = null;
let currentEquationScale = 1;
let speechRunId = 0;
let speechVoices = [];
let speechRunActive = false;

function restoreWaitingUi() {
  $('#waiting h1').textContent = t('selectPassage');
  $('#waiting p').textContent = t('selectPassageHelp');
  $('#waitingAction').textContent = t('readSelection');
  $('#loadingProgress').classList.add('hidden');
}

function setLoadingProgress(message, details = {}) {
  const progress = normalizeLoadingProgress(details);
  const bar = $('#loadingBar');
  $('#waiting p').textContent = message;
  $('#loadingPercent').textContent = progress.label;
  $('#loadingProgress').classList.remove('hidden');
  bar.setAttribute('aria-label', message);
  if (progress.value === null) bar.removeAttribute('value');
  else bar.value = progress.value;
}

function escapeHtml(value) { const node = document.createElement('span'); node.textContent = value; return node.innerHTML; }
function orpHtml(value) {
  const chars = [...value]; const i = Math.min(orpIndex(value), chars.length - 1);
  return `<span class="orp-left">${escapeHtml(chars.slice(0, i).join(''))}</span><span class="focus-letter">${escapeHtml(chars[i] || '')}</span><span class="orp-right">${escapeHtml(chars.slice(i + 1).join(''))}</span>`;
}
function context(from, to) { return state.items.slice(Math.max(0, from), Math.min(state.items.length, to)).map(item => item.value).join(' '); }
function setContextText(node, value) {
  node.dataset.fullText = value;
  node.textContent = value;
  node.title = value;
}
function fitContextText(node, leadingEllipsis) {
  const value = node.dataset.fullText || '';
  node.textContent = value;
  if (!value || node.clientWidth < 12) {
    if (node.clientWidth < 12) node.textContent = '';
    return;
  }
  if (node.scrollWidth <= node.clientWidth) return;

  let low = 0;
  let high = value.length;
  let best = '\u2026';
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const visibleText = leadingEllipsis
      ? value.slice(middle).trimStart()
      : value.slice(0, middle).trimEnd();
    const candidate = leadingEllipsis
      ? `\u2026${visibleText}`
      : `${visibleText}\u2026`;
    node.textContent = candidate;
    const fits = node.scrollWidth <= node.clientWidth;
    if (fits) {
      best = candidate;
      if (leadingEllipsis) high = middle - 1;
      else low = middle + 1;
    } else if (leadingEllipsis) {
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  node.textContent = best;
}
function layoutHorizontalContext(isEquation = false) {
  const viewport = $('.viewport');
  const previous = $('#previous');
  const next = $('#next');
  if (!stableHorizontalContextEnabled()) {
    previous.style.removeProperty('left');
    previous.style.removeProperty('right');
    next.style.removeProperty('left');
    next.style.removeProperty('right');
    previous.textContent = previous.dataset.fullText || '';
    next.textContent = next.dataset.fullText || '';
    return;
  }

  const viewportBounds = viewport.getBoundingClientRect();
  const inset = 12;
  const gap = 12;
  let wordLeft = viewportBounds.width / 2;
  let wordRight = viewportBounds.width / 2;
  const currentParts = [...$('#current').children];
  if (!isEquation && currentParts.length === 3) {
    wordLeft = currentParts[0].getBoundingClientRect().left - viewportBounds.left;
    wordRight = currentParts[2].getBoundingClientRect().right - viewportBounds.left;
  }

  previous.style.left = `${inset}px`;
  previous.style.right = `${Math.min(
    viewportBounds.width - inset,
    Math.max(inset, viewportBounds.width - wordLeft + gap)
  )}px`;
  next.style.left = `${Math.min(
    viewportBounds.width - inset,
    Math.max(inset, wordRight + gap)
  )}px`;
  next.style.right = `${inset}px`;
  fitContextText(previous, true);
  fitContextText(next, false);
}
function equationImageFor(item) {
  if (item?.type !== 'equation') return null;
  return item.manualImage || state.equationImages[item.equationId] || null;
}

function equationImagePixelRatioFor(item) {
  if (item?.type !== 'equation' || item.manualImage) return 1;
  return state.equationImagePixelRatios[item.equationId] || 1;
}

function renderParagraphOverview() {
  const fragment = document.createDocumentFragment();
  state.items.forEach((item, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.index = String(index);

    if (item.type === 'equation') {
      button.classList.add('math');
      const image = state.overviewMathMode === 'previews'
        ? equationImageFor(item)
        : null;
      if (image) {
        button.classList.add('math-preview');
        button.setAttribute('aria-label', item.equationLabel
          ? `${item.value} ${item.equationLabel}`
          : item.value);
        button.title = button.getAttribute('aria-label');
        const preview = document.createElement('img');
        const pixelRatio = equationImagePixelRatioFor(item);
        preview.dataset.pixelRatio = String(pixelRatio);
        if (pixelRatio > 1) {
          preview.addEventListener('load', () => {
            preview.style.width = `${preview.naturalWidth / pixelRatio}px`;
          }, { once: true });
        }
        preview.src = image;
        preview.alt = '';
        button.append(preview);
      } else {
        button.textContent = item.value;
      }
    } else {
      button.textContent = item.value;
    }

    fragment.append(button, document.createTextNode(' '));
  });
  $('#paragraphText').replaceChildren(fragment);
}

function renderSentence() {
  const { start, end } = sentenceBounds(state.items, state.index);
  $('#sentenceContext').innerHTML = state.items.slice(start, end + 1).map((item, offset) => {
    const index = start + offset;
    return `<span class="${index === state.index ? 'active' : ''}">${escapeHtml(item.value)}</span>`;
  }).join(' ');
}

function stableHorizontalContextEnabled() {
  return state.horizontalContext;
}

function applyContextLayout() {
  const viewport = $('.viewport');
  viewport.classList.toggle('context-horizontal', stableHorizontalContextEnabled());
}

function speechPlaybackAvailable() {
  const voices = availableSpeechVoices(speechVoices);
  const explicitVoiceAvailable = state.speechVoiceName !== AUTOMATIC_SPEECH_VOICE
    && voices.some(voice => voice.voiceName === state.speechVoiceName);
  return Boolean(
    speechApi?.speak
    && speechApi?.stop
    && (explicitVoiceAvailable || localSpeechVoices(voices).length)
  );
}

function renderSpeechVoiceOptions() {
  const select = $('#speechVoice');
  const toggle = $('#speechToggle');
  const toggleIcon = $('#speechToggleIcon');
  const status = $('#speechStatus');
  const voices = availableSpeechVoices(speechVoices)
    .sort((left, right) => {
      const leftAria = isMicrosoftAriaNaturalVoice(left);
      const rightAria = isMicrosoftAriaNaturalVoice(right);
      const leftMicrosoft = /^Microsoft\b/i.test(left.voiceName);
      const rightMicrosoft = /^Microsoft\b/i.test(right.voiceName);
      return Number(rightAria) - Number(leftAria)
        || Number(rightMicrosoft) - Number(leftMicrosoft)
        || left.voiceName.localeCompare(right.voiceName);
    });
  const automatic = document.createElement('option');
  automatic.value = AUTOMATIC_SPEECH_VOICE;
  automatic.textContent = t('automaticLocalVoice');
  const groups = {
    en: document.createElement('optgroup'),
    fr: document.createElement('optgroup'),
    other: document.createElement('optgroup')
  };
  groups.en.label = t('englishVoices');
  groups.fr.label = t('frenchVoices');
  groups.other.label = t('otherVoices');
  for (const voice of voices) {
    const option = document.createElement('option');
    option.value = voice.voiceName;
    const location = t(voice.remote === true ? 'onlineVoice' : 'localVoice');
    const recommendation = isMicrosoftAriaNaturalVoice(voice)
      ? ` - ${t('recommendedVoice')}`
      : '';
    option.textContent = `${voice.voiceName} (${voice.lang || '—'} - ${location}${recommendation})`;
    const language = String(voice.lang || '').toLocaleLowerCase().split('-')[0];
    groups[language === 'en' || language === 'fr' ? language : 'other'].append(option);
  }
  const populatedGroups = Object.values(groups).filter(group => group.children.length);
  select.replaceChildren(automatic, ...populatedGroups);
  if (!voices.some(voice => voice.voiceName === state.speechVoiceName)) {
    state.speechVoiceName = AUTOMATIC_SPEECH_VOICE;
  }
  select.value = state.speechVoiceName;
  const playbackAvailable = speechPlaybackAvailable();
  if (!playbackAvailable) state.speechEnabled = false;
  toggle.disabled = !playbackAvailable;
  toggle.setAttribute('aria-pressed', String(state.speechEnabled));
  toggle.classList.toggle('active', state.speechEnabled);
  toggleIcon.textContent = state.speechEnabled ? '🔊' : '🔇';
  const toggleLabel = t(state.speechEnabled ? 'disableSpeech' : 'enableSpeech');
  toggle.title = toggleLabel;
  toggle.setAttribute('aria-label', toggleLabel);
  select.disabled = !voices.length;

  const selectedVoice = voices.find(voice => voice.voiceName === state.speechVoiceName);
  if (selectedVoice?.remote === true) {
    status.textContent = t('onlineVoicePrivacy');
    status.classList.remove('hidden');
  } else if (!playbackAvailable) {
    status.textContent = voices.length
      ? t('chooseOnlineVoice')
      : t('speechUnavailable');
    status.classList.remove('hidden');
  } else {
    status.classList.add('hidden');
  }
}

async function refreshSpeechVoices() {
  try {
    speechVoices = await speechApi?.getVoices?.() || [];
  } catch (error) {
    console.warn(error);
    speechVoices = [];
  }
  renderSpeechVoiceOptions();
}

function applyLanguage() {
  setUiLanguage(state.uiLanguage);
  applyDocumentTranslations(document);
  renderSpeechVoiceOptions();
  if (state.items.length) {
    renderParagraphOverview();
    render();
  }
  else restoreWaitingUi();
  feedbackController?.refreshLanguage?.();
}

function resizeEquationSnapshot(scale = currentEquationScale) {
  const snapshot = $('#equationSnapshot');
  const width = equationSnapshotWidth(
    snapshot.naturalWidth,
    scale,
    Number(snapshot.dataset.pixelRatio) || 1
  );
  if (width) snapshot.style.width = `${width}px`;
}

function applyResponsiveSizing(isEquation = state.items[state.index]?.type === 'equation') {
  const horizontal = matchMedia('(min-width: 600px)').matches;
  const viewport = $('.viewport');
  const scale = readerContentScale(viewport.clientHeight, horizontal);
  const equationScale = equationContentScale(scale, state.equationImageSize);
  currentEquationScale = equationScale;
  document.documentElement.style.setProperty('--reader-scale', String(scale));
  document.documentElement.style.setProperty('--equation-scale', String(equationScale));
  resizeEquationSnapshot(equationScale);
  const baseSize = isEquation ? Math.max(38, state.fontSize * .7) : state.fontSize;
  const current = $('#current');
  const preferredSize = Math.round(baseSize * scale);
  current.style.fontSize = `${preferredSize}px`;
  if (!isEquation) {
    const partWidths = [...current.children].map(
      (node) => Math.max(node.getBoundingClientRect().width, node.scrollWidth)
    );
    const focusHalf = (partWidths[1] || 0) / 2;
    const leftExtent = (partWidths[0] || 0) + focusHalf;
    const rightExtent = (partWidths[2] || 0) + focusHalf;
    let sizeRatio = 1;

    if (stableHorizontalContextEnabled()) {
      const laneWidth = horizontalContextLaneWidth(
        viewport.clientWidth,
        state.contextSize
      );
      const halfWidth = current.clientWidth / 2;
      const edgeAndWordGap = 8;
      const previousLane = $('#previous').dataset.fullText ? laneWidth : 0;
      const nextLane = $('#next').dataset.fullText ? laneWidth : 0;
      const availableLeft = Math.max(45, halfWidth - edgeAndWordGap - previousLane);
      const availableRight = Math.max(45, halfWidth - edgeAndWordGap - nextLane);
      sizeRatio = Math.min(
        1,
        leftExtent ? availableLeft / leftExtent : 1,
        rightExtent ? availableRight / rightExtent : 1
      );
    } else {
      const availableWidth = Math.max(90, viewport.clientWidth - 32);
      const renderedWidth = (partWidths[1] || 0)
        + 2 * Math.max(partWidths[0] || 0, partWidths[2] || 0);
      sizeRatio = renderedWidth > availableWidth
        ? availableWidth / renderedWidth
        : 1;
    }

    if (sizeRatio < 1) {
      current.style.fontSize = `${Math.max(18, Math.floor(preferredSize * sizeRatio))}px`;
    }
  }
  layoutHorizontalContext(isEquation);
}

function render() {
  if (!state.items.length) return;
  const item = state.items[state.index];
  const isEquation = item.type === 'equation';
  const equationLabel = item.equationLabel || parseEquationLabel(item.value);
  const equationImage = equationImageFor(item);
  setContextText($('#previous'), context(state.index - state.contextSize, state.index));
  setContextText($('#next'), context(state.index + 1, state.index + 1 + state.contextSize));
  renderSentence();
  $('#current').innerHTML = isEquation ? 'ƒ(x)' : orpHtml(item.value);
  $('#current').classList.toggle('hidden', isEquation);
  applyResponsiveSizing(isEquation);
  $('#equationCard').classList.toggle('hidden', !isEquation);
  $('#equation').textContent = isEquation && !equationImage
    ? (state.equationLookupComplete
        ? (item.errorMessage || t('faithfulCaptureUnavailable'))
        : t('searchingPdf'))
    : '';
  $('#equationVisual').classList.toggle('hidden', !isEquation || !equationImage);
  $('#equation').classList.toggle('hidden', isEquation && !!equationImage);
  $('#equationLabel').textContent = equationLabel || '';
  $('#equationLabel').classList.toggle(
    'hidden',
    !isEquation || !equationImage || !equationLabel
  );
  $('#equationSource').textContent = isEquation && equationImage
    ? t('localPdfCapture')
    : (isEquation && state.equationLookupComplete
        ? (state.pageCapture ? t('frameManually') : t('notationUnidentified'))
        : t('analyzingPdfPage'));
  if (isEquation && equationImage) {
    const snapshot = $('#equationSnapshot');
    snapshot.dataset.pixelRatio = String(equationImagePixelRatioFor(item));
    if (snapshot.getAttribute('src') !== equationImage) {
      snapshot.style.removeProperty('width');
      snapshot.src = equationImage;
    } else {
      resizeEquationSnapshot();
    }
  }
  $('#copyEquationImage').classList.toggle('hidden', !isEquation || !equationImage);
  $('#copyEquationImage').disabled = false;
  $('#copyEquationImage').textContent = t('copyImage');
  $('#copyEquationImage').title = t('copyEquationImage');
  $('#manualCaptureEquation').classList.toggle('hidden', !isEquation || !!equationImage || !state.pageCapture);
  $('#continueEquation').classList.toggle('hidden', !isEquation || state.equationMode !== 'manual');
  $('#continueEquation').textContent = t(
    state.index >= state.items.length - 1 ? 'finish' : 'understoodContinue'
  );
  $('#seek').value = state.index;
  $('#position').textContent = `${state.index + 1} / ${state.items.length}`;
  $('#percent').textContent = `${Math.round((state.index + 1) / state.items.length * 100)} %`;
  document.querySelectorAll('#paragraphText [data-index]').forEach(node => node.classList.toggle('active', Number(node.dataset.index) === state.index));
  $('#overviewPosition').textContent = t('wordPosition', {
    current: state.index + 1,
    total: state.items.length
  });
  $('#paragraphText [data-index].active')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
}

function stopSpeechPlayback() {
  speechRunId++;
  clearTimeout(state.timer);
  if (speechRunActive) {
    speechRunActive = false;
    speechApi?.stop?.();
  }
}

function scheduleSpeechFallback(runId, chunk, position = 0) {
  clearTimeout(state.timer);
  if (runId !== speechRunId || !state.playing || position >= chunk.entries.length - 1) return;
  const currentEntry = chunk.entries[position];
  state.timer = setTimeout(() => {
    if (runId !== speechRunId || !state.playing) return;
    const nextPosition = position + 1;
    state.index = chunk.entries[nextPosition].index;
    render();
    scheduleSpeechFallback(runId, chunk, nextPosition);
  }, readingDelay(state.items[currentEntry.index], state.wpm, 'off'));
}

function finishSpeechChunk(runId, chunk) {
  if (runId !== speechRunId || !state.playing) return;
  speechRunActive = false;
  clearTimeout(state.timer);
  const nextIndex = chunk.endIndex + 1;
  if (nextIndex >= state.items.length) {
    state.index = chunk.endIndex;
    render();
    pause();
    return;
  }
  state.index = nextIndex;
  render();
  schedule();
}

function failSpeechPlayback(runId, error) {
  if (runId !== speechRunId || !state.playing) return;
  console.warn(error);
  speechRunId++;
  speechApi?.stop?.();
  speechRunActive = false;
  state.speechEnabled = false;
  renderSpeechVoiceOptions();
  save();
  schedule();
}

function startSpeechPlayback() {
  stopSpeechPlayback();
  if (!state.playing) return;
  const item = state.items[state.index];
  if (item?.type === 'equation') {
    if (state.equationMode === 'manual') {
      pause();
      return;
    }
    const runId = speechRunId;
    state.timer = setTimeout(() => {
      if (runId !== speechRunId || !state.playing) return;
      if (state.index >= state.items.length - 1) {
        pause();
        return;
      }
      state.index++;
      render();
      schedule();
    }, readingDelay(item, state.wpm, state.adaptivePacing));
    return;
  }

  const chunk = buildSpeechChunk(state.items, state.index);
  if (!chunk.text || !chunk.entries.length) {
    state.timer = setTimeout(() => {
      if (state.index >= state.items.length - 1) pause();
      else {
        state.index++;
        render();
        schedule();
      }
    }, readingDelay(item, state.wpm, state.adaptivePacing));
    return;
  }

  const runId = speechRunId;
  const locale = detectSpeechLocale(chunk.text, getUiLanguage());
  const voice = selectSpeechVoice(
    speechVoices,
    state.speechVoiceName,
    locale
  );
  let boundaryReceived = false;
  const options = {
    lang: voice?.lang || locale,
    rate: speechRateFromWpm(state.wpm),
    enqueue: false,
    desiredEventTypes: ['start', 'word', 'end', 'error'],
    onEvent: event => {
      if (runId !== speechRunId || !state.playing) return;
      if (event.type === 'start') {
        scheduleSpeechFallback(runId, chunk);
      } else if (event.type === 'word') {
        boundaryReceived = true;
        clearTimeout(state.timer);
        const itemIndex = speechItemIndexAtBoundary(chunk.entries, event.charIndex);
        if (itemIndex !== null && itemIndex !== state.index) {
          state.index = itemIndex;
          render();
        }
      } else if (event.type === 'end') {
        finishSpeechChunk(runId, chunk);
      } else if (event.type === 'error') {
        failSpeechPlayback(runId, event.errorMessage || t('speechUnavailable'));
      }
    }
  };
  if (voice?.voiceName) options.voiceName = voice.voiceName;

  speechRunActive = true;
  try {
    Promise.resolve(speechApi.speak(chunk.text, options))
      .catch(error => failSpeechPlayback(runId, error));
  } catch (error) {
    failSpeechPlayback(runId, error);
  }

  setTimeout(() => {
    if (runId === speechRunId && state.playing && !boundaryReceived) {
      scheduleSpeechFallback(runId, chunk);
    }
  }, Math.max(250, readingDelay(item, state.wpm, 'off')));
}

function pause() {
  state.playing = false;
  stopSpeechPlayback();
  $('#play').textContent = '▶';
}
function play() {
  if (!state.items.length) return;
  state.playing = true;
  $('#play').textContent = '❚❚';
  schedule();
}
function schedule() {
  clearTimeout(state.timer);
  if (!state.playing) return;
  if (state.speechEnabled && speechPlaybackAvailable()) {
    startSpeechPlayback();
    return;
  }
  if (speechRunActive) stopSpeechPlayback();
  const item = state.items[state.index];
  if (item.type === 'equation' && state.equationMode === 'manual') { pause(); return; }
  if (state.index >= state.items.length - 1) { pause(); return; }
  state.timer = setTimeout(() => { state.index++; render(); schedule(); }, readingDelay(item, state.wpm, state.adaptivePacing));
}
function move(delta) { state.index = Math.max(0, Math.min(state.items.length - 1, state.index + delta)); render(); if (state.playing) schedule(); }
function replaySentence() {
  if (!state.items.length) return;
  state.index = replaySentenceIndex(state.items, state.index);
  render();
  if (state.playing) schedule();
}

async function loadSelection(payload) {
  selectionAbortController?.abort();
  const abortController = new AbortController();
  selectionAbortController = abortController;
  const loadId = ++selectionLoadId;
  pause();
  state.items = [];
  state.index = 0;
  state.equationImages = {};
  state.equationImagePixelRatios = {};
  state.equationLookupComplete = false;
  state.selectionPayload = payload;
  state.pageNumber = null;
  state.pageCapture = payload?.pageCapture || null;
  $('#reader').classList.add('hidden');
  $('#waiting').classList.remove('hidden');
  $('#waiting h1').textContent = t('localMathAnalysis');
  setLoadingProgress(t('openingPdf'), { indeterminate: true });
  $('#waitingAction').textContent = t('documentStaysLocal');
  try { $('#source').textContent = payload.sourceUrl ? new URL(payload.sourceUrl).pathname.split('/').pop() || t('openPdf') : t('pdfSelection'); } catch { $('#source').textContent = t('pdfSelection'); }
  try {
    const result = await renderVisualSelectionFromPdf(
      payload,
      (status, progress) => {
        if (loadId === selectionLoadId) setLoadingProgress(status, progress);
      },
      { signal: abortController.signal }
    );
    if (loadId !== selectionLoadId) return;
    setLoadingProgress(t('readingReady'), { value: 100 });
    state.items = result.items;
    state.equationImages = result.images || {};
    state.equationImagePixelRatios = result.imagePixelRatios || {};
    state.pageCapture = result.pageCapture || state.pageCapture || null;
    state.pageNumber = result.pageNumber || null;
    state.equationLookupComplete = true;
    const count = Object.keys(state.equationImages).length;
    const total = state.items.filter(item => item.type === 'equation').length;
    $('#captureButton').textContent = total && count === total
      ? t('allNotations', { count })
      : (total ? t('someNotations', { count, total }) : t('noNotation'));
  } catch (error) {
    if (error?.name === 'AbortError') return;
    if (loadId !== selectionLoadId) return;
    console.warn(error);
    state.items = [{
      value: t('mathAnalysisUnavailable'),
      type: 'equation',
      equationId: 'detection-failed',
      unresolved: true,
      errorMessage: error.message
    }];
    state.equationLookupComplete = true;
    $('#captureButton').textContent = t('detectionUnavailable');
    $('#captureButton').title = error.message;
  }
  if (!state.items.length) return;
  $('#waiting').classList.add('hidden');
  $('#reader').classList.remove('hidden');
  $('#captureButton').classList.remove('hidden');
  $('#captureButton').disabled = !state.pageCapture;
  $('#captureButton').title = state.pageCapture
    ? t('chooseNotation')
    : t('manualCaptureUnavailable');
  $('#seek').max = state.items.length - 1;
  renderParagraphOverview();
  render();
  pause();
}

function clearSelection() {
  selectionAbortController?.abort();
  selectionAbortController = null;
  selectionLoadId++;
  pause();
  state.items = [];
  state.equationImages = {};
  state.equationImagePixelRatios = {};
  state.selectionPayload = null;
  state.pageCapture = null;
  state.pageNumber = null;
  restoreWaitingUi();
  $('#reader').classList.add('hidden');
  $('#waiting').classList.remove('hidden');
}

function continuePastEquation() {
  if (state.index >= state.items.length - 1) {
    clearSelection();
    return;
  }
  move(1);
  play();
}

function togglePlayback() {
  const action = playbackAction(state);
  if (action === 'pause') pause();
  else if (action === 'play') play();
  else if (action === 'continue-equation' || action === 'finish-equation') {
    continuePastEquation();
  }
}

$('#play').onclick = togglePlayback;
$('#equationSnapshot').onload = () => resizeEquationSnapshot();
$('#replaySentence').onclick = replaySentence;
$('#back').onclick = () => move(-5); $('#forward').onclick = () => move(5);
$('#continueEquation').onclick = continuePastEquation;
$('#copyEquationImage').onclick = async () => {
  const button = $('#copyEquationImage');
  const image = equationImageFor(state.items[state.index]);
  if (!image) return;

  button.disabled = true;
  try {
    await copyPngDataUrl(image);
    button.textContent = t('imageCopied');
  } catch (error) {
    console.warn(t('copyEquationFailed'), error);
    button.textContent = t('copyFailed');
    button.title = error.message;
  }

  setTimeout(() => {
    button.disabled = false;
    button.textContent = t('copyImage');
    button.title = t('copyEquationImage');
  }, 1600);
};
$('#seek').oninput = event => { state.index = Number(event.target.value); render(); if (state.playing) schedule(); };
$('#wpm').oninput = event => { state.wpm = Number(event.target.value); $('#wpmValue').textContent = state.wpm; if (state.playing) schedule(); save(); };
document.querySelectorAll('[name="equationMode"]').forEach(radio => radio.onchange = event => { state.equationMode = event.target.value; render(); if (state.playing) schedule(); save(); });
document.querySelectorAll('[name="adaptivePacing"]').forEach(radio => radio.onchange = event => {
  state.adaptivePacing = normalizeAdaptivePacing(event.target.value);
  if (state.playing) schedule();
  save();
});
$('#fontSize').oninput = event => { state.fontSize = Number(event.target.value); render(); save(); };
$('#equationImageSize').oninput = event => {
  state.equationImageSize = normalizeEquationImageSize(event.target.value);
  $('#equationImageSizeValue').textContent = `${state.equationImageSize} %`;
  applyResponsiveSizing();
  save();
};
$('#contextSize').onchange = event => { state.contextSize = Number(event.target.value); render(); save(); };
$('#horizontalContext').onchange = event => {
  state.horizontalContext = event.target.checked;
  applyContextLayout();
  render();
  save();
};
$('#overviewMathMode').onchange = event => {
  state.overviewMathMode = normalizeOverviewMathMode(event.target.value);
  renderParagraphOverview();
  render();
  save();
};
$('#speechToggle').onclick = () => {
  if (!speechPlaybackAvailable()) return;
  state.speechEnabled = !state.speechEnabled;
  renderSpeechVoiceOptions();
  if (state.playing) schedule();
  save();
};
$('#speechVoice').onchange = event => {
  state.speechVoiceName = event.target.value;
  renderSpeechVoiceOptions();
  if (state.playing && state.speechEnabled) schedule();
  save();
};
$('#readerFont').onchange = event => {
  state.readerFont = applyReaderFont(document.documentElement, event.target.value);
  save();
};
$('#readerTheme').onchange = event => {
  state.readerTheme = applyReaderTheme(document.documentElement, event.target.value);
  save();
};
$('#uiLanguage').onchange = event => {
  state.uiLanguage = normalizeUiLanguagePreference(event.target.value);
  applyLanguage();
  save();
};
$('#settingsButton').onclick = () => {
  refreshSpeechVoices();
  $('#settings').showModal();
};
$('#clear').onclick = clearSelection;
$('#paragraphText').onclick = event => { const word = event.target.closest('[data-index]'); if (!word) return; state.index = Number(word.dataset.index); render(); if (state.playing) schedule(); };
document.addEventListener('keydown', event => {
  const controlsBlocked = event.target.closest('input, select, textarea')
    || $('#settings').open
    || $('#cropDialog').open
    || $('#feedbackDialog').open;
  if (event.code === 'Space') {
    if (event.repeat || controlsBlocked) return;
    event.preventDefault();
    togglePlayback();
  }
  if (controlsBlocked) return;
  if (event.code === 'ArrowUp') {
    event.preventDefault();
    replaySentence();
  }
  if (event.code === 'ArrowLeft') move(-1);
  if (event.code === 'ArrowRight') move(1);
});
let resizeFrame = null;
window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => applyResponsiveSizing());
});
window.addEventListener('pagehide', stopSpeechPlayback);

async function save() {
  await extensionStorage.set({
    uiLanguage: state.uiLanguage,
    panelSettings: { wpm: state.wpm, equationMode: state.equationMode, adaptivePacing: state.adaptivePacing, contextSize: state.contextSize, horizontalContext: state.horizontalContext, overviewMathMode: state.overviewMathMode, speechEnabled: state.speechEnabled, speechVoiceName: state.speechVoiceName, fontSize: state.fontSize, equationImageSize: state.equationImageSize, readerFont: state.readerFont, readerTheme: state.readerTheme }
  });
}
async function restore() {
  const { panelSettings = {}, uiLanguage = 'auto' } = await extensionStorage.get(['panelSettings', 'uiLanguage']);
  const { betaFeatures: _removedBetaFeature, ...supportedSettings } = panelSettings;
  if (_removedBetaFeature === true) supportedSettings.horizontalContext = false;
  Object.assign(state, supportedSettings);
  if (Object.hasOwn(panelSettings, 'betaFeatures')) {
    await extensionStorage.set({ panelSettings: supportedSettings });
  }
  state.uiLanguage = normalizeUiLanguagePreference(uiLanguage);
  setUiLanguage(state.uiLanguage);
  applyDocumentTranslations(document);
  state.adaptivePacing = normalizeAdaptivePacing(state.adaptivePacing);
  state.horizontalContext = state.horizontalContext === true;
  state.overviewMathMode = normalizeOverviewMathMode(state.overviewMathMode);
  state.speechEnabled = state.speechEnabled === true;
  state.speechVoiceName = typeof state.speechVoiceName === 'string'
    ? state.speechVoiceName
    : AUTOMATIC_SPEECH_VOICE;
  state.equationImageSize = normalizeEquationImageSize(state.equationImageSize);
  state.readerFont = normalizeReaderFont(state.readerFont);
  state.readerTheme = normalizeReaderTheme(state.readerTheme);
  applyReaderFont(document.documentElement, state.readerFont);
  applyReaderTheme(document.documentElement, state.readerTheme);
  applyContextLayout();
  $('#wpm').value = state.wpm; $('#wpmValue').textContent = state.wpm; $('#fontSize').value = state.fontSize; $('#equationImageSize').value = state.equationImageSize; $('#equationImageSizeValue').textContent = `${state.equationImageSize} %`; $('#contextSize').value = state.contextSize; $('#horizontalContext').checked = state.horizontalContext; $('#overviewMathMode').value = state.overviewMathMode; $('#readerFont').value = state.readerFont; $('#readerTheme').value = state.readerTheme; $('#uiLanguage').value = state.uiLanguage;
  const radio = $(`[name="equationMode"][value="${state.equationMode}"]`); if (radio) radio.checked = true;
  const pacingRadio = $(`[name="adaptivePacing"][value="${state.adaptivePacing}"]`); if (pacingRadio) pacingRadio.checked = true;
  await refreshSpeechVoices();
}

await restore();
speechApi?.onVoicesChanged?.addListener?.(refreshSpeechVoices);
feedbackController = initializeFeedback({
  getContext: () => {
    const payload = state.selectionPayload || {};
    return {
      extensionVersion: api?.runtime?.getManifest?.().version || 'development',
      browser: navigator.userAgent,
      pageNumber: state.pageNumber,
      itemIndex: state.items.length ? state.index : null,
      itemCount: state.items.length,
      equationCount: state.items.filter(item => item.type === 'equation').length,
      unresolvedEquationCount: state.items.filter(item => item.unresolved).length,
      sourceUrl: payload.frameUrl || payload.sourceUrl || payload.tabUrl || '',
      selectionText: payload.text || '',
      pageCapture: state.pageCapture,
      locale: getUiLanguage()
    };
  },
  onOpen: pause
});
const { activeSelection } = await extensionStorage.get('activeSelection'); if (activeSelection) loadSelection(activeSelection);
api?.storage?.onChanged?.addListener(changes => {
  if (changes.activeSelection?.newValue) loadSelection(changes.activeSelection.newValue);
  if (changes.uiLanguage?.newValue
    && changes.uiLanguage.newValue !== state.uiLanguage) {
    state.uiLanguage = normalizeUiLanguagePreference(changes.uiLanguage.newValue);
    $('#uiLanguage').value = state.uiLanguage;
    applyLanguage();
  }
});

const cropStage = $('.crop-stage');
const cropCanvas = $('#cropCanvas');
let cropStart = null;

async function openCropEditor() {
  if (!state.pageCapture) return;
  const image = new Image(); image.src = state.pageCapture; await image.decode();
  const maxWidth = Math.min(900, window.innerWidth - 70), maxHeight = Math.min(520, window.innerHeight - 170);
  const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight, 1);
  cropCanvas.width = Math.round(image.naturalWidth * scale); cropCanvas.height = Math.round(image.naturalHeight * scale);
  cropCanvas.dataset.scale = String(scale); cropCanvas.getContext('2d').drawImage(image, 0, 0, cropCanvas.width, cropCanvas.height);
  state.cropRect = null; $('#cropSelection').style.display = 'none'; $('#applyCrop').disabled = true; $('#cropDialog').showModal();
}

cropStage.addEventListener('pointerdown', event => {
  const bounds = cropCanvas.getBoundingClientRect();
  cropStart = { x: Math.max(0, event.clientX - bounds.left), y: Math.max(0, event.clientY - bounds.top) };
  $('#cropSelection').style.display = 'block';
  cropStage.setPointerCapture(event.pointerId);
});
cropStage.addEventListener('pointermove', event => {
  if (!cropStart) return;
  const bounds = cropCanvas.getBoundingClientRect();
  const x = Math.max(0, Math.min(bounds.width, event.clientX - bounds.left));
  const y = Math.max(0, Math.min(bounds.height, event.clientY - bounds.top));
  const left = Math.min(cropStart.x, x), top = Math.min(cropStart.y, y);
  const width = Math.abs(x - cropStart.x), height = Math.abs(y - cropStart.y);
  Object.assign($('#cropSelection').style, { left:`${left}px`, top:`${top}px`, width:`${width}px`, height:`${height}px` });
  const scale = Number(cropCanvas.dataset.scale); state.cropRect = { x:left/scale, y:top/scale, width:width/scale, height:height/scale };
  $('#applyCrop').disabled = width < 20 || height < 10;
});
cropStage.addEventListener('pointerup', () => { cropStart = null; });
$('#captureButton').onclick = openCropEditor;
$('#manualCaptureEquation').onclick = openCropEditor;
$('#cancelCrop').onclick = () => $('#cropDialog').close();
$('#applyCrop').onclick = async () => {
  if (!state.cropRect) return;
  const image = await cropCaptureRect(state.pageCapture, state.cropRect);
  if (state.items[state.index]?.type === 'equation') state.items[state.index].manualImage = image;
  else { state.items.splice(state.index, 0, { value:t('manuallyCapturedEquation'), type:'equation', manualImage:image }); }
  $('#seek').max = state.items.length - 1; $('#cropDialog').close(); renderParagraphOverview(); render(); pause();
};
