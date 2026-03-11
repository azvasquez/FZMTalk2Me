import { CHARACTER_NAME } from './config.js';

const bubble     = document.getElementById('speech-bubble');
const bubbleText = document.getElementById('speech-bubble-text');
const chatLog    = document.getElementById('chat-log');
const chatInput  = document.getElementById('chat-input');
const sendBtn    = document.getElementById('send-btn');

let bubbleTimer = null;

// ─── Speech bubble ────────────────────────────────────────────

export function showBubble(text) {
  clearTimeout(bubbleTimer);

  bubbleText.textContent = text;
  bubble.classList.remove('hidden', 'fade-out');
  bubble.classList.add('visible');

  // Auto-hide after a generous reading time (~250 ms/word, min 5 s)
  const delay = Math.max(5000, text.split(/\s+/).length * 250);
  bubbleTimer = setTimeout(hideBubble, delay);
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

  // Scroll to latest
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
  chatInput.disabled = isLoading;
  sendBtn.disabled   = isLoading;
  sendBtn.textContent = isLoading ? '···' : 'Send →';
}

export function getInputText() {
  return chatInput.value.trim();
}

export function clearInput() {
  chatInput.value = '';
  chatInput.focus();
}

// ─── Event wiring ─────────────────────────────────────────────

/** Call cb() when the user decides to send (button click or Ctrl/Cmd+Enter). */
export function onSend(cb) {
  sendBtn.addEventListener('click', cb);

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      cb();
    }
  });
}
