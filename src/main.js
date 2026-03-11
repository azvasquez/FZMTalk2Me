import './style.css';
import { initLive2D, applyMood, resetMood } from './live2d.js';
import { sendMessage, jumpToHistory } from './chat.js';
import {
  showSpeaking,
  showListening,
  showWaiting,
  splitIntoChunks,
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
  bg.style.backgroundImage  = `url(${BACKGROUND_PATH})`;
  bg.style.backgroundSize   = 'cover';
  bg.style.backgroundPosition = 'center';
}

// ─── Live2D (non-blocking) ────────────────────────────────────
const canvas = document.getElementById('live2d-canvas');
initLive2D(canvas).then((loaded) => {
  if (!loaded) appendSystemNote('Avatar model not loaded — check MODEL_PATH in src/config.js');
});

// ─── Welcome ──────────────────────────────────────────────────
applyMood('happy');
showSpeaking([`Ne~! ${CHARACTER_NAME} is here.`, `Take your time — I'm listening whenever you're ready.`]);

// ─── Send handler ─────────────────────────────────────────────
onSend(async () => {
  const text = getInputText();
  if (!text) return;

  clearInput();
  appendLogEntry('user', text, -1);
  showWaiting();

  try {
    const { reply, mood, historyIdx } = await sendMessage(text);

    appendLogEntry('assistant', reply, historyIdx);
    applyMood(mood);
    showSpeaking(splitIntoChunks(reply));

    // Return to neutral after speaking is done (generous estimate)
    const speakingMs = reply.split(/\s+/).length * 300 + 2000;
    setTimeout(resetMood, speakingMs);
  } catch (err) {
    const msg = err?.status === 401
      ? 'Invalid API key — check your .env file.'
      : `Error: ${err?.message ?? 'something went wrong'}`;
    appendSystemNote(msg);
    showListening();
  }
});

// ─── Log jump (rewind) ────────────────────────────────────────
onLogJump((historyIdx, text) => {
  jumpToHistory(historyIdx);
  showSpeaking(splitIntoChunks(text));
  appendSystemNote(`↩ Rewound to an earlier point in the conversation.`);
});
