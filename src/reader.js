import { extractPdf } from './pdf-engine.js';
import { segmentText, flattenSentences, orpIndex, delayFor } from './text-engine.js';

const api = globalThis.browser ?? globalThis.chrome;
const $ = (selector) => document.querySelector(selector);
const state = { sentences: [], tokens: [], index: 0, playing: false, timer: null, wpm: 300, mode: 'classic', smartPauses: true, showOrp: true, title: '' };

function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2600); }
function formatTime(seconds) { const s = Math.max(0, Math.round(seconds)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
function estimatedSeconds(count) { return count / state.wpm * 60; }

function renderOrp(word) {
  const chars = [...word];
  const i = Math.min(orpIndex(word), chars.length - 1);
  if (!state.showOrp) return `<span>${escapeHtml(word)}</span>`;
  const left = chars.slice(0, i).join('');
  const focus = chars[i] || '';
  const right = chars.slice(i + 1).join('');
  return `<span>${escapeHtml(left)}</span><span class="orp">${escapeHtml(focus)}</span><span>${escapeHtml(right)}</span>`;
}
function escapeHtml(value) { const div = document.createElement('div'); div.textContent = value; return div.innerHTML; }

function renderContext(token) {
  const sentence = state.sentences[token.sentenceIndex];
  $('#context').innerHTML = sentence.tokens.map((item, i) => `<span class="${i === token.tokenIndex ? 'current' : ''} ${item.isMath ? 'math' : ''}">${escapeHtml(item.value)}</span>`).join('');
}

function render() {
  if (!state.tokens.length) return;
  const token = state.tokens[state.index];
  $('#orpWord').innerHTML = renderOrp(token.value);
  renderContext(token);
  $('#equationBadge').classList.toggle('hidden', !token.isMath);
  $('#seek').value = state.index;
  const progress = state.tokens.length <= 1 ? 0 : state.index / (state.tokens.length - 1);
  $('#progressFill').style.width = `${progress * 100}%`;
  $('#progressText').textContent = `${Math.round(progress * 100)} % · mot ${state.index + 1} / ${state.tokens.length}`;
  $('#elapsed').textContent = formatTime(estimatedSeconds(state.index));
  $('#remaining').textContent = `−${formatTime(estimatedSeconds(state.tokens.length - state.index))}`;
  document.querySelectorAll('#outline li').forEach((li, i) => li.classList.toggle('active', i === token.sentenceIndex));
  const active = $(`#outline li[data-index="${token.sentenceIndex}"]`); active?.scrollIntoView({ block: 'nearest' });
}

function tick() {
  clearTimeout(state.timer);
  if (!state.playing) return;
  if (state.index >= state.tokens.length - 1) { pause(); return; }
  const token = state.tokens[state.index];
  const delay = state.smartPauses ? delayFor(token, state.wpm) : 60000 / state.wpm;
  state.timer = setTimeout(() => { state.index++; render(); tick(); }, delay);
}
function play() { if (!state.tokens.length) return; state.playing = true; $('#play').textContent = '❚❚'; tick(); }
function pause() { state.playing = false; clearTimeout(state.timer); $('#play').textContent = '▶'; }
function toggle() { state.playing ? pause() : play(); }

function loadDocument({ text, title = 'Document', pages = null, source = '' }) {
  pause();
  state.sentences = segmentText(text);
  state.tokens = flattenSentences(state.sentences);
  state.index = 0; state.title = title;
  if (!state.tokens.length) return toast('Aucun texte exploitable trouvé. Le PDF est peut-être une image scannée.');
  $('#empty').classList.add('hidden'); $('#workspace').classList.remove('hidden');
  $('#docTitle').textContent = title; $('#meta').textContent = `${pages ? `${pages} pages · ` : ''}${state.tokens.length} mots${source ? ` · ${new URL(source).hostname}` : ''}`;
  $('#seek').max = Math.max(0, state.tokens.length - 1);
  $('#outline').innerHTML = state.sentences.map((s, i) => `<li data-index="${i}" title="${escapeHtml(s.text)}">${escapeHtml(s.text)}</li>`).join('');
  render(); saveSettings();
}

async function loadPdf(source, label) {
  toast('Extraction du PDF…');
  try {
    const result = await extractPdf(source, (page, total) => toast(`Extraction : page ${page} / ${total}`));
    loadDocument({ ...result, title: result.title || label, source: typeof source === 'string' ? source : '' });
    toast('PDF prêt à lire');
  } catch (error) { console.error(error); toast('Impossible de lire ce PDF. Vérifiez son accès ou téléchargez-le d’abord.'); }
}

function setMode(mode) {
  state.mode = mode; pause();
  $('#classic').classList.toggle('hidden', mode !== 'classic'); $('#context').classList.toggle('hidden', mode !== 'context');
  document.querySelectorAll('.mode-tabs button').forEach(b => b.classList.toggle('active', b.dataset.mode === mode)); saveSettings();
}
async function saveSettings() { await api.storage?.local.set({ readerSettings: { wpm: state.wpm, mode: state.mode, smartPauses: state.smartPauses, showOrp: state.showOrp, dark: document.documentElement.classList.contains('dark') } }); }
async function restoreSettings() {
  const data = await api.storage?.local.get('readerSettings'); const s = data?.readerSettings || {};
  state.wpm = s.wpm || 300; state.smartPauses = s.smartPauses ?? true; state.showOrp = s.showOrp ?? true;
  $('#wpm').value = state.wpm; $('#wpmValue').textContent = state.wpm; $('#smartPauses').checked = state.smartPauses; $('#showOrp').checked = state.showOrp;
  document.documentElement.classList.toggle('dark', !!s.dark); setMode(s.mode || 'classic');
}

$('#file').addEventListener('change', async (e) => { const file = e.target.files[0]; if (file) await loadPdf({ data: new Uint8Array(await file.arrayBuffer()) }, file.name); });
$('#urlBtn').onclick = () => { const url = $('#url').value.trim(); if (url) loadPdf(url, url.split('/').pop()); };
$('#pasteBtn').onclick = () => $('#pasteDialog').showModal();
$('#loadText').onclick = () => { const text = $('#pasteText').value.trim(); if (text) loadDocument({ text, title: 'Texte collé' }); };
$('#play').onclick = toggle; $('#back').onclick = () => { state.index = Math.max(0, state.index - 5); render(); }; $('#forward').onclick = () => { state.index = Math.min(state.tokens.length - 1, state.index + 5); render(); };
$('#seek').oninput = e => { state.index = Number(e.target.value); render(); };
$('#wpm').oninput = e => { state.wpm = Number(e.target.value); $('#wpmValue').textContent = state.wpm; render(); if (state.playing) tick(); saveSettings(); };
$('#fontSize').oninput = e => { $('#orpWord').style.fontSize = `${e.target.value}px`; $('#context').style.fontSize = `${Math.max(22, e.target.value * .64)}px`; };
document.querySelectorAll('.mode-tabs button').forEach(b => b.onclick = () => setMode(b.dataset.mode));
$('#settingsBtn').onclick = () => $('#settings').showModal(); $('#smartPauses').onchange = e => { state.smartPauses = e.target.checked; saveSettings(); }; $('#showOrp').onchange = e => { state.showOrp = e.target.checked; render(); saveSettings(); };
$('#theme').onclick = () => { document.documentElement.classList.toggle('dark'); saveSettings(); };
$('#outline').onclick = e => { const li = e.target.closest('li'); if (!li) return; const i = state.tokens.findIndex(t => t.sentenceIndex === Number(li.dataset.index)); if (i >= 0) { state.index = i; render(); } };
document.addEventListener('keydown', e => { if (e.target.matches('input,textarea')) return; if (e.code === 'Space') { e.preventDefault(); toggle(); } if (e.code === 'ArrowRight') { state.index = Math.min(state.tokens.length - 1, state.index + 1); render(); } if (e.code === 'ArrowLeft') { state.index = Math.max(0, state.index - 1); render(); } });
for (const event of ['dragenter','dragover']) $('#drop').addEventListener(event, e => { e.preventDefault(); $('#drop').classList.add('drag'); });
for (const event of ['dragleave','drop']) $('#drop').addEventListener(event, e => { e.preventDefault(); $('#drop').classList.remove('drag'); });
$('#drop').addEventListener('drop', async e => { const file = [...e.dataTransfer.files].find(f => f.type === 'application/pdf' || f.name.endsWith('.pdf')); if (file) loadPdf({ data: new Uint8Array(await file.arrayBuffer()) }, file.name); });

await restoreSettings();
const params = new URLSearchParams(location.search);
if (params.get('pdf')) loadPdf(params.get('pdf'), 'PDF');
if (params.get('error')) toast(params.get('error'));
if (params.get('transfer')) { const key = params.get('transfer'); const data = await api.storage.local.get(key); if (data[key]) { loadDocument(data[key]); await api.storage.local.remove(key); } }
