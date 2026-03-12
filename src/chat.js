import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT, CHARACTER_ANCHOR, PROVIDER, OLLAMA_MODEL, OLLAMA_BASE_URL, CLAUDE_MODEL } from './config.js';

// Claude client (constructed lazily — not used when PROVIDER = 'ollama')
let _claudeClient = null;
function getClaudeClient() {
  if (!_claudeClient) {
    _claudeClient = new Anthropic({
      apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
      dangerouslyAllowBrowser: true,
    });
  }
  return _claudeClient;
}

/** Full conversation history sent to the model on every turn. */
const history = [];

// Inject a character anchor every N history entries to combat context drift.
// Lower = more frequent reminders; higher = less cache-busting overhead for local models.
const ANCHOR_EVERY = 16;

function buildMessages() {
  if (history.length < ANCHOR_EVERY) return history;
  const result = [];
  for (let i = 0; i < history.length; i++) {
    if (i > 0 && i % ANCHOR_EVERY === 0) {
      result.push({ role: 'system', content: CHARACTER_ANCHOR });
    }
    result.push(history[i]);
  }
  return result;
}


async function sendClaude(userText) {
  const response = await getClaudeClient().messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    messages: buildMessages(),
  });
  return response.content[0].text;
}

async function sendOllama(userText) {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      options: { num_predict: 350 },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...buildMessages(),
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Ollama error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.message.content;
}

/**
 * Send a user message and get the assistant's reply + mood.
 * @param {string} userText
 * @returns {Promise<{ reply: string, mood: string }>}
 */
export async function sendMessage(userText) {
  history.push({ role: 'user', content: userText });

  const raw = PROVIDER === 'ollama'
    ? await sendOllama(userText)
    : await sendClaude(userText);

  // Strip leading tags and action blocks before storing — model sees clean dialogue only
  const clean = raw.trim()
    .replace(/^(\[[^\]]+\]\s*)+/i, '')
    .replace(/\*[^*\n]+\*/g, '')
    .trim();
  history.push({ role: 'assistant', content: clean });

  return { raw, historyIdx: history.length - 1 };
}

/** Clear conversation history (start fresh). */
export function resetHistory() {
  history.length = 0;
}

/**
 * Truncate history to just after the given index.
 * Used for log "rewind" — lets the user branch from any past point.
 */
export function jumpToHistory(idx) {
  history.length = idx + 1;
}
