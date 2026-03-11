import './style.css';
import { initLive2D, setMotion } from './live2d.js';
import { sendMessage } from './chat.js';
import {
  showBubble,
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
    const reply = await sendMessage(text);
    appendMessage('assistant', reply);
    showBubble(reply);
    setMotion('tap_body'); // trigger a reaction motion if the model supports it
  } catch (err) {
    const msg = err?.status === 401
      ? 'Invalid API key — check your .env file.'
      : `Error: ${err?.message ?? 'something went wrong.'}`;
    appendSystemNote(msg);
    console.error('[FZMTalk2Me]', err);
  }

  setLoading(false);
});
