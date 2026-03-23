const MAX_BUBBLES = 4;

let bubbles   = [];  // { id, segments, tags, userText, historyIdx, preview }
let container = null;
let playFn    = null;

/**
 * @param {HTMLElement} containerEl
 * @param {(bubble) => void} onPlay  called with the bubble object when played
 */
export function initBubbles(containerEl, onPlay) {
  container = containerEl;
  playFn    = onPlay;
}

export function addBubble({ segments, tags, userText, historyIdx }) {
  if (bubbles.length >= MAX_BUBBLES) _remove(bubbles[0].id);

  const preview = segments.find(s => s.type === 'dialogue')?.text ?? '...';
  const id      = Date.now() + Math.random();

  bubbles.push({ id, segments, tags, userText, historyIdx, preview });
  _render(id, preview);
}

/** Remove and return the oldest pending bubble, or null if empty. */
export function popFirst() {
  if (!bubbles.length) return null;
  const b = bubbles.shift();
  _remove(b.id);
  return b;
}

export function hasBubbles() {
  return bubbles.length > 0;
}

// ─── Internal ─────────────────────────────────────────────────

function _remove(id) {
  const el = container?.querySelector(`[data-id="${id}"]`);
  if (el) {
    el.classList.add('bubble-exit');
    setTimeout(() => el.remove(), 250);
  }
  bubbles = bubbles.filter(b => b.id !== id);
}

function _render(id, preview) {
  if (!container) return;

  const el = document.createElement('button');
  el.className    = 'pending-bubble';
  el.dataset.id   = id;
  el.title        = 'Click to play';

  const dot = document.createElement('span');
  dot.className = 'bubble-dot';

  const text = document.createElement('span');
  text.className   = 'bubble-text';
  text.textContent = preview.length > 48 ? preview.slice(0, 48) + '…' : preview;

  el.appendChild(dot);
  el.appendChild(text);

  el.addEventListener('click', () => {
    const idx = bubbles.findIndex(b => b.id === id);
    if (idx === -1) return;
    const [b] = bubbles.splice(idx, 1);
    el.classList.add('bubble-exit');
    setTimeout(() => el.remove(), 250);
    playFn?.(b);
  });

  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('bubble-enter'));
}
