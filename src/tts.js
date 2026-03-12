import { VOICEVOX_BASE_URL, VOICEVOX_SPEAKER } from './config.js';
import { toJapanese } from './translate.js';

let currentAudio     = null;
let currentObjectUrl = null;

function cleanup() {
  if (currentAudio)     { currentAudio.pause(); currentAudio = null; }
  if (currentObjectUrl) { URL.revokeObjectURL(currentObjectUrl); currentObjectUrl = null; }
}

/**
 * Synthesise and play text via VOICEVOX.
 * Silently no-ops if VOICEVOX isn't running.
 */
export async function speak(text) {
  cleanup();
  try {
    const japanese = await toJapanese(text);
    const qr = await fetch(
      `${VOICEVOX_BASE_URL}/audio_query?text=${encodeURIComponent(japanese)}&speaker=${VOICEVOX_SPEAKER}`,
      { method: 'POST' }
    );
    if (!qr.ok) throw new Error(`audio_query ${qr.status}`);

    const sr = await fetch(
      `${VOICEVOX_BASE_URL}/synthesis?speaker=${VOICEVOX_SPEAKER}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(await qr.json()),
      }
    );
    if (!sr.ok) throw new Error(`synthesis ${sr.status}`);

    currentObjectUrl = URL.createObjectURL(await sr.blob());
    currentAudio = new Audio(currentObjectUrl);
    currentAudio.addEventListener('ended', cleanup, { once: true });
    await currentAudio.play();
  } catch (err) {
    console.warn('[VOICEVOX]', err.message);
  }
}

/** Stop any currently playing speech. */
export function stopSpeaking() {
  cleanup();
}
