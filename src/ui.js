import { CHARACTER_NAME } from './config.js';

const bubble     = document.getElementById('speech-bubble');
const bubbleText = document.getElementById('speech-bubble-text');
const bubbleMore = document.getElementById('bubble-more');
const chatLog    = document.getElementById('chat-log');
const chatInput  = document.getElementById('chat-input');
const sendBtn    = document.getElementById('send-btn');

let bubbleTimer   = null;
let chunks        = [];
let chunkIndex    = 0;
let currentAnchor = null;

// Reading speed: ms per word, with a min/max per chunk
const MS_PER_WORD = 320;
const MIN_MS      = 2000;
const MAX_MS      = 7000;

function readingDelay(text) {
  return Math.min(MAX_MS, Math.max(MIN_MS, text.split(/\s+/).length * MS_PER_WORD));
}

// ─── Sentence splitting ───────────────────────────────────────

/**
 * Split a response into individual sentence-sized chunks for VN-style display.
 */
export function splitIntoChunks(text) {
  const parts = text.split(/(?<=[.!?])\s+(?=[A-Z"'\u{1F000}-\u{1FFFF}])/u);
  return parts.map(s => s.trim()).filter(Boolean);
}

// ─── Speech bubble ────────────────────────────────────────────

function positionBubble(anchor) {
  if (anchor) {
    const rawBottom     = window.innerHeight - anchor.top + 16;
    const clampedBottom = Math.min(rawBottom, window.innerHeight - 180);
    bubble.style.bottom = `${clampedBottom}px`;
    bubble.style.left   = `${anchor.left}px`;
  } else {
    bubble.style.bottom = '';
    bubble.style.left   = '50%';
  }
}

function renderChunk() {
  clearTimeout(bubbleTimer);

  const text   = chunks[chunkIndex];
  const isLast = chunkIndex === chunks.length - 1;

  bubbleText.textContent = text;
  positionBubble(currentAnchor);

  // ▼ indicator: visible between chunks, hidden on last
  bubbleMore.classList.toggle('hidden', isLast);

  // Re-trigger pop animation
  bubble.classList.remove('visible', 'fade-out', 'hidden');
  bubble.offsetWidth; // reflow
  bubble.classList.add('visible');

  // Schedule next chunk or final hide
  if (!isLast) {
    bubbleTimer = setTimeout(() => {
      chunkIndex++;
      renderChunk();
    }, readingDelay(text));
  } else {
    bubbleTimer = setTimeout(hideBubble, readingDelay(text));
  }
}

/**
 * Begin VN-style autoplay of sentence chunks.
 * @param {string[]} chunkList
 * @param {{ top: number, left: number } | null} anchor
 */
export function showBubble(chunkList, anchor = null) {
  chunks        = chunkList.length ? chunkList : [''];
  chunkIndex    = 0;
  currentAnchor = anchor;
  renderChunk();
}

export function hideBubble() {
  clearTimeout(bubbleTimer);
  bubble.classList.add('fade-out');
  setTimeout(() => {
    bubble.classList.remove('visible', 'fade-out');
    bubble.classList.add('hidden');
  }, 400);
}

// ─── Chat log ─────────────────────────────────────────────────

export function appendMessage(role, text) {
  const wrap = document.createElement('div');
  wrap.classList.add('message', role);

  const label = document.createElement('span');
  label.classList.add('label');
  label.textContent = role === 'user' ? 'You' : CHARACTER_NAME;

  const body = document.createElement('p');
  body.textContent = text;

  wrap.appendChild(label);
  wrap.appendChild(body);
  chatLog.appendChild(wrap);
  chatLog.scrollTop = chatLog.scrollHeight;
}

export function appendSystemNote(text) {
  const note = document.createElement('div');
  note.classList.add('system-note');
  note.textContent = text;
  chatLog.appendChild(note);
  chatLog.scrollTop = chatLog.scrollHeight;
}

// ─── Input state ──────────────────────────────────────────────

export function setLoading(isLoading) {
  chatInput.disabled  = isLoading;
  sendBtn.disabled    = isLoading;
  sendBtn.textContent = isLoading ? '···' : 'Send →';
}

export function getInputText()  { return chatInput.value.trim(); }
export function clearInput()    { chatInput.value = ''; chatInput.focus(); }

// ─── Event wiring ─────────────────────────────────────────────

export function onSend(cb) {
  sendBtn.addEventListener('click', cb);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      cb();
    }
  });
}
