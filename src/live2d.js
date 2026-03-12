import * as PIXI from 'pixi.js';
import { Live2DModel } from 'pixi-live2d-display/cubism4';
import { MODEL_PATH } from './config.js';

// Required: pixi-live2d-display reads PIXI from the global scope.
window.PIXI = PIXI;

let app   = null;
let model = null;
const bgEl = document.getElementById('background');

// Home state — saved after fitModel() so we can animate back to it
let home  = null;  // { x, y, scaleX, scaleY }

// Active animation frame handle
let animFrame = null;

/**
 * Initialize PixiJS and load the Live2D model onto the given canvas.
 * Fails gracefully — the rest of the app works fine without a model.
 */
export async function initLive2D(canvasEl) {
  app = new PIXI.Application({
    view: canvasEl,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundAlpha: 0,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
  });

  try {
    model = await Live2DModel.from(MODEL_PATH, { autoInteract: false });
    app.stage.addChild(model);
    fitModel();
    window.addEventListener('resize', onResize);
    console.info('[Live2D] Model loaded:', MODEL_PATH);
    return true;
  } catch (err) {
    console.warn(
      '[Live2D] Could not load model — running in text-only mode.\n' +
      'Check that MODEL_PATH in src/config.js is correct and the model files are in public/.',
      err
    );
    return false;
  }
}

function fitModel() {
  if (!model || !app) return;

  const vW = window.innerWidth;
  const vH = window.innerHeight;

  // Show the top VISIBLE portion of the model (head → thighs); feet crop below viewport.
  // Matches DDLC-style framing: character fills the screen, dialogue box floats over.
  const VISIBLE  = 0.67;   // fraction of model height shown (thighs-up)
  const scaleByH = (vH * 0.97) / (model.internalModel.height * VISIBLE);
  const scaleByW = (vW * 0.82) / model.internalModel.width;
  const scale    = Math.min(scaleByH, scaleByW);

  model.scale.set(scale);

  // Center horizontally; anchor so thighs land at the bottom of the viewport
  model.x = (vW - model.width) / 2;
  model.y = vH - model.height * VISIBLE;

  home = { x: model.x, y: model.y, scaleX: model.scale.x, scaleY: model.scale.y };
}

/**
 * Returns the model's screen-space bounds so the speech bubble can
 * anchor itself just above the model's top edge regardless of window size.
 */
export function getModelBounds() {
  if (!model) return null;
  return {
    top:    model.y,                          // px from top of viewport
    left:   model.x + model.width / 2,        // horizontal center of model
    width:  model.width,
  };
}

function onResize() {
  if (!app) return;
  app.renderer.resize(window.innerWidth, window.innerHeight);
  fitModel();
}

// Maps mood names → expression index in the model's expression list.
// Verified against mao_pro.model3.json expressions array order (0-based).
const MOOD_EXPRESSION = {
  neutral:   0, // exp_01 — calm default
  happy:     1, // exp_02 — closed-eye smile
  shy:       2, // exp_03 — sleepy/soft
  excited:   3, // exp_04 — wide eyes + sparkle ✨
  sad:       4, // exp_05 — pouty mouth down
  blush:     5, // exp_06 — red cheeks
  surprised: 6, // exp_07 — wide eyes, "o" mouth
  angry:     7, // exp_08 — angry brows + mouth
};

// Motion groups in the model (unnamed group = '').
// Indices 0-2: normal reactions; 3-5: specials.
const MOOD_MOTION = {
  neutral:   [0, 1, 2],   // any of mtn_02/03/04
  happy:     [0, 1],
  shy:       [0],
  excited:   [3, 4, 5],   // special motions
  sad:       [1],
  blush:     [0, 1],
  surprised: [2, 3],
  angry:     [2],
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Trigger a mood by name — sets the matching expression and a body motion.
 * Falls back to neutral for unknown moods.
 */
export function applyMood(mood) {
  if (!model) return;

  const exprIdx  = MOOD_EXPRESSION[mood] ?? MOOD_EXPRESSION.neutral;
  const motionIdx = pick(MOOD_MOTION[mood] ?? MOOD_MOTION.neutral);

  try { model.expression(exprIdx); }  catch { /* no-op */ }
  try { model.motion('', motionIdx, 2 /* NORMAL priority */); } catch { /* no-op */ }
}

/** Return to idle state. */
export function resetMood() {
  if (!model) return;
  try { model.expression(MOOD_EXPRESSION.neutral); } catch { /* no-op */ }
  try { model.motion('Idle', 0); } catch { /* no-op */ }
}

// ─── Camera & visual direction ────────────────────────────────

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

/**
 * Animate model properties from their current values to targets.
 * Supports: x, y, scaleX, scaleY, alpha
 */
function animateTo(targets, duration, onDone) {
  if (!model) { onDone?.(); return; }
  if (animFrame) cancelAnimationFrame(animFrame);

  const start = performance.now();
  const from  = {
    x:      model.x,
    y:      model.y,
    scaleX: model.scale.x,
    scaleY: model.scale.y,
    alpha:  model.alpha,
  };

  function tick(now) {
    const t = easeInOut(Math.min(1, (now - start) / duration));
    for (const [key, to] of Object.entries(targets)) {
      const val = from[key] + (to - from[key]) * t;
      if (key === 'scaleX') model.scale.x = val;
      else if (key === 'scaleY') model.scale.y = val;
      else model[key] = val;
    }
    if (t < 1) {
      animFrame = requestAnimationFrame(tick);
    } else {
      animFrame = null;
      onDone?.();
    }
  }
  animFrame = requestAnimationFrame(tick);
}

// ─── Background coupling ──────────────────────────────────────

/**
 * Animate the CSS background element to match camera moves.
 * Uses CSS transitions so it stays in sync without RAF overhead.
 */
function bgTransform(transform, duration, transformOrigin = '50% 50%') {
  if (!bgEl) return;
  bgEl.style.transition      = `transform ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
  bgEl.style.transformOrigin = transformOrigin;
  bgEl.style.transform       = transform;
}

/**
 * Apply a camera directive from the AI.
 * @param {'face'|'full'|null} cam
 * @param {'left'|'right'|null} fade
 * @param {boolean} show
 * @param {boolean} hide
 */
export function applyCameraDirective({ cam, fade, show, hide }) {
  if (!model || !home) return;

  if (hide) {
    animateTo({ alpha: 0 }, 500);
    return;
  }
  if (show) {
    animateTo({ alpha: 1 }, 500);
    return;
  }

  if (fade) {
    // Slide model off one side, snap to other, slide back in
    const dir    = fade === 'left' ? -1 : 1;
    const slideX = window.innerWidth * 0.35 * dir;
    // Background drifts subtly in the same direction then resets
    bgTransform(`translateX(${dir * 3}%)`, 420);
    animateTo({ x: home.x + slideX, alpha: 0 }, 420, () => {
      model.x     = home.x - slideX;
      model.alpha = 0;
      bgTransform('translateX(0)', 420);
      animateTo({ x: home.x, alpha: 1 }, 420);
    });
    return;
  }

  if (cam === 'face') {
    const Z = 1.6;

    const newScaleX = home.scaleX * Z;
    const newScaleY = home.scaleY * Z;
    const newW      = model.internalModel.width  * newScaleX;
    const newH      = model.internalModel.height * newScaleY;

    // Center on the face region (roughly top 18% of model) in the viewport
    const targetX = window.innerWidth  / 2 - newW / 2;
    const targetY = window.innerHeight * 0.38 - newH * 0.18;

    // Background zooms toward the face region (upper center of screen)
    bgTransform('scale(1.18) translateY(-3%)', 650, '50% 22%');
    animateTo({ x: targetX, y: targetY, scaleX: newScaleX, scaleY: newScaleY }, 650);
    return;
  }

  if (cam === 'full') {
    bgTransform('scale(1) translateY(0)', 650, '50% 50%');
    animateTo({ x: home.x, y: home.y, scaleX: home.scaleX, scaleY: home.scaleY, alpha: 1 }, 650);
  }
}
