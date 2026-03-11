import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT, PROVIDER, OLLAMA_MODEL, OLLAMA_BASE_URL, CLAUDE_MODEL } from './config.js';

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


async function sendClaude(userText) {
  const response = await getClaudeClient().messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    messages: history,
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
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history,
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

  // Strip any leading tags before storing in history so they don't accumulate
  const clean = raw.trim().replace(/^(\[[^\]]+\]\s*)+/i, '').trim();
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
