import './style.css';
import { initLive2D, applyMood, resetMood, applyCameraDirective } from './live2d.js';
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
import { CHARACTER_NAME, BACKGROUND_PATH } from './config.js';

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

    appendLogEntry('assistant', fullText, historyIdx);
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
