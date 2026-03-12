import { CHARACTER_NAME } from './config.js';
import { speak, stopSpeaking } from './tts.js';

// ─── DOM refs ─────────────────────────────────────────────────
const vnSpeaking  = document.getElementById('vn-speaking');
const vnListening = document.getElementById('vn-listening');
const vnWaiting   = document.getElementById('vn-waiting');
const vnName      = document.getElementById('vn-name');
const vnText      = document.getElementById('vn-text');
const vnCursor    = document.getElementById('vn-cursor');
const vnAdvance   = document.getElementById('vn-advance');
const vnDialogue  = document.getElementById('vn-dialogue');
const chatInput   = document.getElementById('chat-input');
const sendBtn     = document.getElementById('send-btn');
const logToggle   = document.getElementById('log-toggle');
const logPanel    = document.getElementById('log-panel');
const logClose    = document.getElementById('log-close');
const logEntries  = document.getElementById('log-entries');

// ─── Timing ───────────────────────────────────────────────────
const MS_PER_WORD    = 300;
const MIN_DISPLAY_MS = 1800;
const MAX_DISPLAY_MS = 6500;
const TYPEWRITER_MS  = 26;   // ms per character

function readingDelay(text) {
  if (!text) return MIN_DISPLAY_MS;
  return Math.min(MAX_DISPLAY_MS, Math.max(MIN_DISPLAY_MS, text.split(/\s+/).length * MS_PER_WORD));
}

// ─── State ────────────────────────────────────────────────────
let chunks          = [];
let chunkIndex      = 0;
let autoTimer       = null;
let autoTimerFireAt = 0;   // absolute timestamp when autoTimer will fire
let typeTimer       = null;
let jumpCb          = null;

// splitIntoChunks kept for legacy callers; new code uses parser.js segments
export function splitIntoChunks(text) {
  const parts = text.split(/(?<=[.!?])\s+(?=[A-Z"'\u{1F000}-\u{1FFFF}])/u);
  return parts.map(s => s.trim()).filter(Boolean).map(t => ({ type: 'dialogue', text: t }));
}

// ─── Panel state switching ────────────────────────────────────

function showState(state) {
  vnSpeaking.classList.add('hidden');
  vnListening.classList.add('hidden');
  vnWaiting.classList.add('hidden');
  ({ speaking: vnSpeaking, listening: vnListening, waiting: vnWaiting })[state]
    ?.classList.remove('hidden');
}

// ─── Typewriter ───────────────────────────────────────────────

function typewrite(text, onComplete) {
  clearInterval(typeTimer);
  if (!text) { onComplete?.(); return; }
  vnText.textContent = '';
  vnCursor.classList.remove('hidden');
  let i = 0;
  typeTimer = setInterval(() => {
    vnText.textContent = text.slice(0, ++i);
    if (i >= text.length) {
      clearInterval(typeTimer);
      typeTimer = null;
      vnCursor.classList.add('hidden');
      onComplete?.();
    }
  }, TYPEWRITER_MS);
}

function skipTypewriter() {
  if (!typeTimer) return;
  clearInterval(typeTimer);
  typeTimer = null;
  stopSpeaking();
  vnText.textContent = chunks[chunkIndex].text;
  vnCursor.classList.add('hidden');
  onChunkTyped();
}

function advanceNow() {
  clearTimeout(autoTimer);
  autoTimer = null;
  stopSpeaking();
  vnAdvance.classList.add('hidden');
  const isLast = chunkIndex === chunks.length - 1;
  if (!isLast) {
    chunkIndex++;
    renderChunk();
  } else {
    showListening();
  }
}

// Click dialogue box: skip typewriter if typing, otherwise advance chunk —
// but ignore if auto-advance is already about to fire within 500 ms.
vnDialogue.addEventListener('click', () => {
  if (typeTimer) {
    skipTypewriter();
  } else if (autoTimer && Date.now() < autoTimerFireAt - 500) {
    advanceNow();
  }
});

// ─── Speaking autoplay ────────────────────────────────────────

function onChunkTyped() {
  const isLast = chunkIndex === chunks.length - 1;

  if (!isLast) {
    vnAdvance.classList.remove('hidden');
    const delay = readingDelay(chunks[chunkIndex].text);
    autoTimerFireAt = Date.now() + delay;
    autoTimer = setTimeout(() => {
      vnAdvance.classList.add('hidden');
      chunkIndex++;
      renderChunk();
    }, delay);
  } else {
    const delay = readingDelay(chunks[chunkIndex].text);
    autoTimerFireAt = Date.now() + delay;
    autoTimer = setTimeout(showListening, delay);
  }
}

function renderChunk() {
  clearTimeout(autoTimer);
  showState('speaking');
  vnAdvance.classList.add('hidden');

  const segment = chunks[chunkIndex];
  if (!segment || !segment.text) { showListening(); return; }
  const isAction = segment.type === 'action';

  // Toggle narrator styling
  vnSpeaking.classList.toggle('narrator', isAction);
  vnName.textContent = isAction ? '' : CHARACTER_NAME;

  if (!isAction) speak(segment.text);
  typewrite(segment.text, onChunkTyped);
}

/**
 * Begin VN-style autoplay through a segment list.
 * Each segment is { type: 'action'|'dialogue', text: string }
 */
export function showSpeaking(segmentList) {
  clearTimeout(autoTimer);
  clearInterval(typeTimer);
  chunks     = segmentList.length ? segmentList : [{ type: 'dialogue', text: '...' }];
  chunkIndex = 0;
  renderChunk();
}

/** Switch to user input state. */
export function showListening() {
  clearTimeout(autoTimer);
  clearInterval(typeTimer);
  stopSpeaking();
  showState('listening');
  setTimeout(() => chatInput.focus(), 40);
}

/** Switch to loading state. */
export function showWaiting() {
  clearTimeout(autoTimer);
  clearInterval(typeTimer);
  stopSpeaking();
  showState('waiting');
}

// ─── Log panel ────────────────────────────────────────────────

function openLog() {
  logPanel.classList.add('open');
  logEntries.scrollTop = logEntries.scrollHeight;
}
function closeLog() {
  logPanel.classList.remove('open');
}

logToggle.addEventListener('click', () =>
  logPanel.classList.contains('open') ? closeLog() : openLog()
);
logClose.addEventListener('click', closeLog);

// ─── Log entries ──────────────────────────────────────────────

/**
 * @param {'user'|'assistant'} role
 * @param {string} text
 * @param {number} historyIdx  — index in chat history; used for jump
 */
export function appendLogEntry(role, text, historyIdx) {
  const entry = document.createElement('div');
  entry.classList.add('log-entry', role);

  const label = document.createElement('span');
  label.classList.add('log-label');
  label.textContent = role === 'user' ? 'You' : CHARACTER_NAME;

  const body = document.createElement('p');
  body.textContent = text;

  entry.appendChild(label);
  entry.appendChild(body);

  if (role === 'assistant') {
    entry.classList.add('jumpable');
    entry.title = 'Rewind conversation to this point';
    entry.addEventListener('click', () => {
      jumpCb?.(historyIdx, text);
      closeLog();
    });
  }

  logEntries.appendChild(entry);

  // Auto-scroll only if already near the bottom
  const nearBottom = logEntries.scrollHeight - logEntries.scrollTop <= logEntries.clientHeight + 60;
  if (nearBottom) logEntries.scrollTop = logEntries.scrollHeight;
}

export function appendSystemNote(text) {
  const note = document.createElement('div');
  note.classList.add('log-system-note');
  note.textContent = text;
  logEntries.appendChild(note);
  logEntries.scrollTop = logEntries.scrollHeight;
}

/** Register callback for when user clicks a log entry to rewind. */
export function onLogJump(cb) { jumpCb = cb; }

// ─── Input ────────────────────────────────────────────────────

export function setLoading(isLoading) {
  chatInput.disabled  = isLoading;
  sendBtn.disabled    = isLoading;
  sendBtn.textContent = isLoading ? '···' : 'Send →';
}

export function getInputText() { return chatInput.value.trim(); }
export function clearInput()   { chatInput.value = ''; }

export function onSend(cb) {
  sendBtn.addEventListener('click', cb);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      cb();
    }
  });
}
