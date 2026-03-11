/**
 * FZMTalk2Me · Response parser
 *
 * Parses the raw AI response into structured tags and a segment queue.
 *
 * Expected AI output format:
 *   [mood:shy][cam:face]
 *   *Her gaze drops, lashes casting soft shadows.*
 *   That's... not something I usually talk about.
 *
 * Tags (all optional, must appear at the very start):
 *   [mood:x]      — expression to trigger (happy, shy, excited, sad, surprised, blush, angry, neutral)
 *   [cam:face]    — zoom in on face
 *   [cam:full]    — return to full body view
 *   [fade:left]   — slide avatar off left, return from right
 *   [fade:right]  — slide avatar off right, return from left
 *   [show]        — fade avatar in
 *   [hide]        — fade avatar out
 *
 * Body:
 *   *text in asterisks*  → action segment (narrator box, italic, no nameplate)
 *   everything else      → dialogue segment (split into sentences for autoplay)
 */

const SENTENCE_SPLIT = /(?<=[.!?])\s+(?=[A-Z"'\u{1F000}-\u{1FFFF}])/u;

export function parseResponse(raw) {
  let text = raw.trim();

  // ── Consume leading tags ────────────────────────────────────
  const tags = {
    mood: 'neutral',
    cam:  null,    // 'face' | 'full' | null
    fade: null,    // 'left' | 'right' | null
    show: false,
    hide: false,
  };

  // Match any bracket tag at the start, greedily
  const TAG_RE = /^\[(?:(mood|cam|fade):(\w+)|(\w+))\]\s*/i;
  let m;
  while ((m = text.match(TAG_RE))) {
    if (m[1]) tags[m[1].toLowerCase()] = m[2].toLowerCase();
    else if (m[3]) tags[m[3].toLowerCase()] = true;
    text = text.slice(m[0].length);
  }

  // ── Parse body into segments ────────────────────────────────
  // Split on *action blocks*, keeping the delimiters
  const segments = [];
  const parts = text.split(/(\*[^*\n]+\*)/g);

  for (const part of parts) {
    const p = part.trim();
    if (!p) continue;

    if (p.startsWith('*') && p.endsWith('*')) {
      // Action/narrator block
      segments.push({ type: 'action', text: p.slice(1, -1).trim() });
    } else {
      // Dialogue — split into sentences for autoplay
      const sentences = p.split(SENTENCE_SPLIT);
      for (const s of sentences) {
        const clean = s.trim();
        if (clean) segments.push({ type: 'dialogue', text: clean });
      }
    }
  }

  return {
    tags,
    segments: segments.length ? segments : [{ type: 'dialogue', text: text }],
  };
}
