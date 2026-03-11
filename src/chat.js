import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT } from './config.js';

// NOTE: API key lives in .env — copy .env.example to .env and fill it in.
// This app is for local personal use only. Do not deploy it publicly.
const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
});

/** Full conversation history sent to Claude on every turn. */
const history = [];

/**
 * Send a user message and get the assistant's reply.
 * @param {string} userText
 * @returns {Promise<string>} assistant reply text
 */
export async function sendMessage(userText) {
  history.push({ role: 'user', content: userText });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    messages: history,
  });

  const reply = response.content[0].text;
  history.push({ role: 'assistant', content: reply });

  return reply;
}

/** Clear conversation history (start fresh). */
export function resetHistory() {
  history.length = 0;
}
