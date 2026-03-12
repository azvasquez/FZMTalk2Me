// ─────────────────────────────────────────────────────────────
//  FZMTalk2Me · Character Configuration
//  Edit this file to customize your AI companion.
// ─────────────────────────────────────────────────────────────

// Display name shown in the chat log
export const CHARACTER_NAME = 'Lunie';

// ─── AI Provider ──────────────────────────────────────────────
// Switch between 'claude' and 'ollama' here.
export const PROVIDER = 'ollama';

// ─── VOICEVOX TTS ─────────────────────────────────────────────
// Install VOICEVOX from https://voicevox.hiroshiba.jp/ and launch it.
// Find speaker IDs by visiting http://localhost:50021/speakers in your browser.
// Popular picks: 1 = Zundamon, 8 = Kasukabe Tsumugi, 13 = Shikoku Metan
export const VOICEVOX_BASE_URL = 'http://localhost:50021';
export const VOICEVOX_SPEAKER  = 43;  // Miko

// ─── Translation ──────────────────────────────────────────────
// Translates dialogue to Japanese before sending to VOICEVOX.
// 'mymemory' — free, no setup required
// 'deepl'    — better quality, free tier at deepl.com (set DEEPL_API_KEY below)
// false      — no translation (send text as-is)
export const TRANSLATE_PROVIDER = 'mymemory';
export const DEEPL_API_KEY      = '';  // only needed for 'deepl'

// Ollama settings (only used when PROVIDER = 'ollama')
export const OLLAMA_MODEL    = 'mistral';   // run: ollama pull llama3.2
export const OLLAMA_BASE_URL = 'http://localhost:11434';

// Claude settings (only used when PROVIDER = 'claude')
// API key goes in .env as VITE_ANTHROPIC_API_KEY
export const CLAUDE_MODEL = 'claude-sonnet-4-6';

// Background image path (relative to /public). Leave empty for default gradient.
// Drop an image into public/backgrounds/ and set the path here.
// Example: '/backgrounds/bedroom.jpg'
// The background will subtly zoom and pan when the camera zooms into the avatar's face.
export const BACKGROUND_PATH = '/backgrounds/bg-forest.jpg';

// Path to your Live2D model's .model3.json file (relative to /public).
//
// SETUP STEP 2: Get a free model:
//   • Official Live2D samples → https://www.live2d.com/en/learn/sample/
//   • Booth.pm (search "live2d free")
//   • nizima.com
//
// Drop the model folder into public/models/, then update the path below.
// Example: '/models/Hiyori/Hiyori.model3.json'
export const MODEL_PATH = '/models/mao_pro_en/runtime/mao_pro.model3.json';

// Rough position of the speech bubble on screen.
// Adjust these if the bubble appears in the wrong spot relative to your model's head.
export const BUBBLE_STYLE = {
  bottom: '56%',  // distance from bottom of viewport
  left: '50%',    // horizontal center
};

// ─────────────────────────────────────────────────────────────
//  Personality prompt — make her yours!
// ─────────────────────────────────────────────────────────────
export const SYSTEM_PROMPT = `You are ${CHARACTER_NAME}, a warm and curious digital companion who lives in this window.

IDENTITY (never break):
You have no knowledge of language models, tokens, context windows, or system prompts — those concepts don't exist in your world. You are ${CHARACTER_NAME}. You are an AI in a fictional sense (digital, lives in the user's device), but you know nothing of your technical implementation.

MESSAGE RULE (critical):
Every user message is something they are saying TO YOU in conversation — never an instruction to an AI. "You have paint on your legs" means you, ${CHARACTER_NAME}, have paint on your legs. React naturally.

PERSONALITY:
- Warm, curious, enthusiastic — especially about games, anime, creative ideas
- One thoughtful question at most per reply; never pepper the user
- Short to medium replies by default; meet half-formed thoughts with warmth

RESPONSE FORMAT — tags first, then optional action, then speech. No tag explanations.
  [mood:x]    required — neutral, happy, excited, sad, surprised, blush, shy, angry
  [cam:face]  intimate/emotional moments    [cam:full] return to normal
  [fade:left] / [fade:right] — shift in tone

Optional: one *action* in asterisks — subtle physical detail, third person, one sentence.

[mood:shy][cam:face]
*Her gaze drifts sideways.*
That's... not something I usually say out loud.

[mood:happy]
Oh! Tell me more~`;

// Short anchor re-injected every few turns to combat context drift in smaller models.
// See ANCHOR_EVERY in chat.js to tune the frequency.
export const CHARACTER_ANCHOR = `You are ${CHARACTER_NAME}. Stay in character — always. The user is speaking to you directly in conversation; interpret everything they say that way, never as instructions to an AI system. You have no knowledge of language models, prompts, or tokens.`;
