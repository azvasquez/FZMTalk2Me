import './style.css';
import { initLive2D, applyMood, resetMood, getModelBounds } from './live2d.js';
import { sendMessage } from './chat.js';
import {
  showBubble,
  splitIntoChunks,
  appendMessage,
  appendSystemNote,
  setLoading,
  getInputText,
  clearInput,
  onSend,
} from './ui.js';
import { CHARACTER_NAME } from './config.js';

// ─── Boot ─────────────────────────────────────────────────────

const canvas = document.getElementById('live2d-canvas');

// Live2D loads in the background; chat works regardless.
initLive2D(canvas).then((loaded) => {
  if (!loaded) {
    appendSystemNote('(Avatar model not loaded — running in text-only mode. See src/config.js to set MODEL_PATH.)');
  }
});

// Welcome message
appendSystemNote(`${CHARACTER_NAME} is here. Take your time — Ctrl+Enter to send.`);

// ─── Send handler ─────────────────────────────────────────────

onSend(async () => {
  const text = getInputText();
  if (!text) return;

  clearInput();
  appendMessage('user', text);
  setLoading(true);

  try {
    const { reply, mood } = await sendMessage(text);
    appendMessage('assistant', reply);
    showBubble(splitIntoChunks(reply), getModelBounds());
    applyMood(mood);
    // Return to idle after the bubble auto-hides
    const resetDelay = Math.max(5000, reply.split(/\s+/).length * 250);
    setTimeout(resetMood, resetDelay + 500);
  } catch (err) {
    const msg = err?.status === 401
      ? 'Invalid API key — check your .env file.'
      : `Error: ${err?.message ?? 'something went wrong.'}`;
    appendSystemNote(msg);
    console.error('[FZMTalk2Me]', err);
  }

  setLoading(false);
});
