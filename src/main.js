import './style.css';
import { initLive2D, applyMood, resetMood, applyCameraDirective, resetView, zoomBy, switchModel } from './live2d.js';
import { sendMessage, jumpToHistory } from './chat.js';
import { parseResponse } from './parser.js';
import {
  showSpeaking,
  showListening,
  showWaiting,
  appendLogEntry,
  appendSystemNote,
  onSend,
  onLogJump,
  getInputText,
  clearInput,
} from './ui.js';
import { CHARACTER_NAME, BACKGROUND_PATH, MODEL_PATH, modelPaths } from './config.js';
import { startListening, stopListening, isListening } from './microphone.js';
import { initBubbles, addBubble, popFirst } from './pendingBubbles.js';

// ─── Background ───────────────────────────────────────────────
if (BACKGROUND_PATH) {
  const bg = document.getElementById('background');
  bg.style.backgroundImage   = `url(${BACKGROUND_PATH})`;
  bg.style.backgroundSize    = 'cover';
  bg.style.backgroundPosition = 'center';
}

// ─── Live2D ───────────────────────────────────────────────────
const canvas = document.getElementById('live2d-canvas');
initLive2D(canvas).then((loaded) => {
  if (!loaded) appendSystemNote('Avatar not loaded — check MODEL_PATH in src/config.js');
});

// ─── Model selector ───────────────────────────────────────────
const modelSelect = document.getElementById('model-select');
for (const [name, path] of Object.entries(modelPaths)) {
  const opt = document.createElement('option');
  opt.value = path;
  opt.textContent = name;
  if (path === MODEL_PATH) opt.selected = true;
  modelSelect.appendChild(opt);
}
modelSelect.addEventListener('change', async () => {
  modelSelect.disabled = true;
  const ok = await switchModel(modelSelect.value);
  if (!ok) appendSystemNote('Failed to load model — check the path in config.js');
  modelSelect.disabled = false;
});

// ─── View controls ────────────────────────────────────────────
document.getElementById('zoom-in').addEventListener('click',    () => zoomBy(1.15));
document.getElementById('zoom-out').addEventListener('click',   () => zoomBy(0.87));
document.getElementById('reset-view').addEventListener('click', () => resetView());

// ─── Pending bubbles ──────────────────────────────────────────
initBubbles(document.getElementById('pending-bubbles'), (bubble) => {
  const logText = bubble.segments.filter(s => s.type === 'dialogue').map(s => s.text).join(' ');
  appendLogEntry('user',      bubble.userText, -1);
  appendLogEntry('assistant', logText, bubble.historyIdx);
  applyDirectives(bubble.tags);
  showSpeaking(bubble.segments);
});

// ─── Microphone ───────────────────────────────────────────────
const micBtn = document.getElementById('mic-toggle');

const TRIGGER_PHRASES = [
  'you have something to say',
  'do you have something to say',
  'what were you going to say',
  'what did you want to say',
  'you were saying',
];

let transcriptBuffer = '';
let transcriptTimer  = null;

function onTranscript({ text, isFinal }) {
  if (!isFinal) return;

  // Trigger phrase: auto-play first pending bubble
  if (TRIGGER_PHRASES.some(p => text.toLowerCase().includes(p))) {
    const b = popFirst();
    if (b) {
      const logText = b.segments.filter(s => s.type === 'dialogue').map(s => s.text).join(' ');
      appendLogEntry('user',      text, -1);
      appendLogEntry('assistant', logText, b.historyIdx);
      applyDirectives(b.tags);
      showSpeaking(b.segments);
    }
    return;
  }

  // Accumulate and debounce — send to AI after 1.5s of silence
  transcriptBuffer += (transcriptBuffer ? ' ' : '') + text;
  clearTimeout(transcriptTimer);
  transcriptTimer = setTimeout(async () => {
    const utterance  = transcriptBuffer.trim();
    transcriptBuffer = '';
    if (!utterance) return;
    try {
      const { raw, historyIdx } = await sendMessage(utterance);
      const { tags, segments }  = parseResponse(raw);
      addBubble({ segments, tags, userText: utterance, historyIdx });
    } catch (err) {
      console.warn('[mic] AI error:', err.message);
    }
  }, 1500);
}

micBtn.addEventListener('click', () => {
  if (isListening()) {
    stopListening();
    micBtn.classList.remove('active');
    micBtn.title = 'Start microphone';
  } else {
    const ok = startListening({
      onTranscript,
      onError: (err) => appendSystemNote(`Mic error: ${err}`),
    });
    if (ok) {
      micBtn.classList.add('active');
      micBtn.title = 'Stop microphone';
    }
  }
});

// ─── Welcome ──────────────────────────────────────────────────
applyMood('happy');
showSpeaking([
  { type: 'action',   text: 'She looks up as you arrive, eyes brightening with quiet recognition.' },
  { type: 'dialogue', text: `Ne~! ${CHARACTER_NAME} is here.` },
  { type: 'dialogue', text: "Take your time — I'm listening whenever you're ready." },
]);

// ─── Helpers ──────────────────────────────────────────────────
function applyDirectives(tags) {
  applyMood(tags.mood);
  if (tags.cam || tags.fade || tags.show || tags.hide) {
    applyCameraDirective(tags);
  }
}

// ─── Send handler ─────────────────────────────────────────────
onSend(async () => {
  const text = getInputText();
  if (!text) return;

  clearInput();
  appendLogEntry('user', text, -1);
  showWaiting();

  try {
    const { raw, historyIdx } = await sendMessage(text);
    const { tags, segments }  = parseResponse(raw);
    const fullText            = segments.map(s => s.text).join(' ');
    const logText             = segments.filter(s => s.type === 'dialogue').map(s => s.text).join(' ');

    appendLogEntry('assistant', logText, historyIdx);
    applyDirectives(tags);
    showSpeaking(segments);

    // Return to neutral/full after speaking finishes
    const speakingMs = fullText.split(/\s+/).length * 300 + 2000;
    setTimeout(() => {
      resetMood();
      applyCameraDirective({ cam: 'full', fade: null, show: false, hide: false });
    }, speakingMs);

  } catch (err) {
    const msg = err?.status === 401
      ? 'Invalid API key — check your .env file.'
      : `Error: ${err?.message ?? 'something went wrong'}`;
    appendSystemNote(msg);
    showListening();
  }
});

// ─── Log rewind ───────────────────────────────────────────────
onLogJump((historyIdx, text) => {
  jumpToHistory(historyIdx);
  const { tags, segments } = parseResponse(text);
  applyDirectives(tags);
  showSpeaking(segments);
  appendSystemNote('↩ Rewound to an earlier point.');
});
