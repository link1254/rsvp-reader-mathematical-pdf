import {
  normalizeAdaptivePacing,
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
import { readerContentScale } from './window-layout.js';
import { initializeFeedback } from './feedback-ui.js';
import { createSynchronizedContext } from './synchronized-context.js';

const api = globalThis.browser ?? globalThis.chrome;
const $ = selector => document.querySelector(selector);
const state = { items: [], index: 0, playing: false, timer: null, wpm: 300, equationMode: 'manual', adaptivePacing: 'normal', contextSize: 3, horizontalContext: false, betaFeatures: false, fontSize: 62, readerFont: 'system', readerTheme: 'classic', equationImages: {}, equationLookupComplete: false, pageCapture: null, pageNumber: null, selectionPayload: null, cropRect: null };
let selectionLoadId = 0;
let selectionAbortController = null;

function restoreWaitingUi() {
  $('#waiting h1').textContent = 'Sélectionnez un passage';
  $('#waiting p').textContent = 'Dans votre PDF, sélectionnez le texte à lire puis faites un clic droit :';
  $('#waitingAction').textContent = 'Lire la sélection avec RSVP Reader';
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

const synchronizedContext = createSynchronizedContext({
  container: $('#sentenceContext'),
  getItems: () => state.items,
  getIndex: () => state.index,
  getEquationImage: equationImageFor,
  onNavigate: index => {
    state.index = index;
    render();
    if (state.playing) schedule();
  }
});

function renderSentence() {
  if (state.betaFeatures) {
    synchronizedContext.update();
    return;
  }
  synchronizedContext.reset();
  const { start, end } = sentenceBounds(state.items, state.index);
  $('#sentenceContext').innerHTML = state.items.slice(start, end + 1).map((item, offset) => {
    const index = start + offset;
    return `<span class="${index === state.index ? 'active' : ''}">${escapeHtml(item.value)}</span>`;
  }).join(' ');
}

function stableHorizontalContextEnabled() {
  return state.horizontalContext && !state.betaFeatures;
}

function applyContextLayout() {
  const viewport = $('.viewport');
  viewport.classList.toggle('context-horizontal', stableHorizontalContextEnabled());
  viewport.classList.toggle('context-synchronized', state.betaFeatures);
  $('#reader').classList.toggle('context-beta-active', state.betaFeatures);
}

function updateBetaInterface() {
  $('#betaFeatures').checked = state.betaFeatures;
  $('#horizontalContext').disabled = state.betaFeatures;
  $('#horizontalContextSetting').classList.toggle('disabled', state.betaFeatures);
  $('#betaSettingStatus').textContent = state.betaFeatures ? 'Bêta active' : 'Version stable';
  $('#betaBadge').classList.toggle('hidden', !state.betaFeatures);
}

function applyResponsiveSizing(isEquation = state.items[state.index]?.type === 'equation') {
  const horizontal = matchMedia('(min-width: 600px)').matches;
  const viewport = $('.viewport');
  const scale = readerContentScale(viewport.clientHeight, horizontal);
  document.documentElement.style.setProperty('--reader-scale', String(scale));
  const baseSize = isEquation ? Math.max(38, state.fontSize * .7) : state.fontSize;
  const current = $('#current');
  const preferredSize = Math.round(baseSize * scale);
  current.style.fontSize = `${preferredSize}px`;
  if (!isEquation) {
    const availableWidth = Math.max(
      90,
      stableHorizontalContextEnabled() ? current.clientWidth : viewport.clientWidth - 32
    );
    const partWidths = [...current.children].map(
      (node) => Math.max(node.getBoundingClientRect().width, node.scrollWidth)
    );
    const renderedWidth =
      (partWidths[1] || 0) + 2 * Math.max(partWidths[0] || 0, partWidths[2] || 0);
    if (renderedWidth > availableWidth) {
      current.style.fontSize = `${Math.max(18, Math.floor(preferredSize * availableWidth / renderedWidth))}px`;
    }
  }
  layoutHorizontalContext(isEquation);
}

function render() {
  if (!state.items.length) return;
  const item = state.items[state.index];
  const isEquation = item.type === 'equation';
  const equationLabel = item.value.match(/\(\d+(?:\.\d+)*\)/)?.[0];
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
        ? (item.errorMessage || 'Capture fidèle indisponible')
        : 'Recherche dans le PDF…')
    : '';
  $('#equationSnapshot').classList.toggle('hidden', !isEquation || !equationImage);
  $('#equation').classList.toggle('hidden', isEquation && !!equationImage);
  $('#equationSource').textContent = isEquation && equationImage
    ? `Détection locale — capture du PDF ${equationLabel || ''}`
    : (isEquation && state.equationLookupComplete
        ? (state.pageCapture ? 'Encadrez cette formule manuellement' : 'Notation non identifiée')
        : 'Analyse locale de la page PDF');
  if (isEquation && equationImage) $('#equationSnapshot').src = equationImage;
  $('#copyEquationImage').classList.toggle('hidden', !isEquation || !equationImage);
  $('#copyEquationImage').disabled = false;
  $('#copyEquationImage').textContent = 'Copier l’image';
  $('#copyEquationImage').title = 'Copier l’image de l’équation';
  $('#manualCaptureEquation').classList.toggle('hidden', !isEquation || !!equationImage || !state.pageCapture);
  $('#continueEquation').classList.toggle('hidden', !isEquation || state.equationMode !== 'manual');
  $('#continueEquation').textContent = state.index >= state.items.length - 1 ? 'Terminer' : 'J’ai compris — continuer';
  $('#seek').value = state.index;
  $('#position').textContent = `${state.index + 1} / ${state.items.length}`;
  $('#percent').textContent = `${Math.round((state.index + 1) / state.items.length * 100)} %`;
  document.querySelectorAll('#paragraphText [data-index]').forEach(node => node.classList.toggle('active', Number(node.dataset.index) === state.index));
  $('#overviewPosition').textContent = `Mot ${state.index + 1} sur ${state.items.length}`;
  $('#paragraphText [data-index].active')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
}

function pause() { state.playing = false; clearTimeout(state.timer); $('#play').textContent = '▶'; }
function play() { if (!state.items.length) return; state.playing = true; $('#play').textContent = '❚❚'; schedule(); }
function schedule() {
  clearTimeout(state.timer);
  if (!state.playing) return;
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
  synchronizedContext.reset();
  state.index = 0;
  state.equationImages = {};
  state.equationLookupComplete = false;
  state.selectionPayload = payload;
  state.pageNumber = null;
  state.pageCapture = payload?.pageCapture || null;
  $('#reader').classList.add('hidden');
  $('#waiting').classList.remove('hidden');
  $('#waiting h1').textContent = 'Analyse mathématique locale';
  setLoadingProgress('Ouverture du PDF…', { indeterminate: true });
  $('#waitingAction').textContent = 'Le document reste sur cet ordinateur.';
  try { $('#source').textContent = payload.sourceUrl ? new URL(payload.sourceUrl).pathname.split('/').pop() || 'PDF ouvert' : 'Sélection PDF'; } catch { $('#source').textContent = 'Sélection PDF'; }
  try {
    const result = await renderVisualSelectionFromPdf(
      payload,
      (status, progress) => {
        if (loadId === selectionLoadId) setLoadingProgress(status, progress);
      },
      { signal: abortController.signal }
    );
    if (loadId !== selectionLoadId) return;
    setLoadingProgress('Lecture prête', { value: 100 });
    state.items = result.items;
    state.equationImages = result.images || {};
    state.pageCapture = result.pageCapture || state.pageCapture || null;
    state.pageNumber = result.pageNumber || null;
    state.equationLookupComplete = true;
    const count = Object.keys(state.equationImages).length;
    const total = state.items.filter(item => item.type === 'equation').length;
    $('#captureButton').textContent = total && count === total
      ? `✓ ${count} notations`
      : (total ? `⚠ ${count}/${total} notations` : 'Aucune notation');
  } catch (error) {
    if (error?.name === 'AbortError') return;
    if (loadId !== selectionLoadId) return;
    console.warn(error);
    state.items = [{
      value: 'Analyse mathématique indisponible',
      type: 'equation',
      equationId: 'detection-failed',
      unresolved: true,
      errorMessage: error.message
    }];
    state.equationLookupComplete = true;
    $('#captureButton').textContent = '⚠ Détection indisponible';
    $('#captureButton').title = error.message;
  }
  if (!state.items.length) return;
  $('#waiting').classList.add('hidden');
  $('#reader').classList.remove('hidden');
  $('#captureButton').classList.remove('hidden');
  $('#captureButton').disabled = !state.pageCapture;
  $('#captureButton').title = state.pageCapture
    ? 'Choisir visuellement une notation'
    : 'Capture manuelle indisponible';
  $('#seek').max = state.items.length - 1;
  $('#paragraphText').innerHTML = state.items.map((item, index) => `<button data-index="${index}" class="${item.type === 'equation' ? 'math' : ''}">${escapeHtml(item.value)}</button>`).join(' ');
  render();
  pause();
}

function clearSelection() {
  selectionAbortController?.abort();
  selectionAbortController = null;
  selectionLoadId++;
  pause();
  state.items = [];
  synchronizedContext.reset();
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
    button.textContent = 'Image copiée';
  } catch (error) {
    console.warn('Impossible de copier la capture de l’équation', error);
    button.textContent = 'Copie impossible';
    button.title = error.message;
  }

  setTimeout(() => {
    button.disabled = false;
    button.textContent = 'Copier l’image';
    button.title = 'Copier l’image de l’équation';
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
$('#contextSize').onchange = event => { state.contextSize = Number(event.target.value); render(); save(); };
$('#horizontalContext').onchange = event => {
  state.horizontalContext = event.target.checked;
  applyContextLayout();
  render();
  save();
};
$('#betaFeatures').onchange = event => {
  state.betaFeatures = event.target.checked;
  synchronizedContext.reset();
  applyContextLayout();
  updateBetaInterface();
  render();
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
$('#settingsButton').onclick = () => $('#settings').showModal();
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

async function save() { await api.storage.local.set({ panelSettings: { wpm: state.wpm, equationMode: state.equationMode, adaptivePacing: state.adaptivePacing, contextSize: state.contextSize, horizontalContext: state.horizontalContext, betaFeatures: state.betaFeatures, fontSize: state.fontSize, readerFont: state.readerFont, readerTheme: state.readerTheme } }); }
async function restore() {
  const { panelSettings = {} } = await api.storage.local.get('panelSettings'); Object.assign(state, panelSettings);
  state.adaptivePacing = normalizeAdaptivePacing(state.adaptivePacing);
  state.horizontalContext = state.horizontalContext === true;
  state.betaFeatures = state.betaFeatures === true;
  state.readerFont = normalizeReaderFont(state.readerFont);
  state.readerTheme = normalizeReaderTheme(state.readerTheme);
  applyReaderFont(document.documentElement, state.readerFont);
  applyReaderTheme(document.documentElement, state.readerTheme);
  applyContextLayout();
  updateBetaInterface();
  $('#wpm').value = state.wpm; $('#wpmValue').textContent = state.wpm; $('#fontSize').value = state.fontSize; $('#contextSize').value = state.contextSize; $('#horizontalContext').checked = state.horizontalContext; $('#readerFont').value = state.readerFont; $('#readerTheme').value = state.readerTheme;
  const radio = $(`[name="equationMode"][value="${state.equationMode}"]`); if (radio) radio.checked = true;
  const pacingRadio = $(`[name="adaptivePacing"][value="${state.adaptivePacing}"]`); if (pacingRadio) pacingRadio.checked = true;
}

await restore();
initializeFeedback({
  getContext: () => {
    const payload = state.selectionPayload || {};
    return {
      extensionVersion: api.runtime.getManifest().version,
      browser: navigator.userAgent,
      pageNumber: state.pageNumber,
      itemIndex: state.items.length ? state.index : null,
      itemCount: state.items.length,
      equationCount: state.items.filter(item => item.type === 'equation').length,
      unresolvedEquationCount: state.items.filter(item => item.unresolved).length,
      sourceUrl: payload.frameUrl || payload.sourceUrl || payload.tabUrl || '',
      selectionText: payload.text || '',
      pageCapture: state.pageCapture
    };
  },
  onOpen: pause
});
const { activeSelection } = await api.storage.local.get('activeSelection'); if (activeSelection) loadSelection(activeSelection);
api.storage.onChanged.addListener(changes => { if (changes.activeSelection?.newValue) loadSelection(changes.activeSelection.newValue); });

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
  else { state.items.splice(state.index, 0, { value:'Équation capturée manuellement', type:'equation', manualImage:image }); }
  $('#seek').max = state.items.length - 1; $('#cropDialog').close(); render(); pause();
};
