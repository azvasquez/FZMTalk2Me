import * as PIXI from 'pixi.js';
import { Live2DModel } from 'pixi-live2d-display/cubism4';
import { MODEL_PATH } from './config.js';

// Required: pixi-live2d-display reads PIXI from the global scope.
window.PIXI = PIXI;

let app   = null;
let model = null;

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

  // Available height = viewport minus the VN panel (clamped same as CSS)
  const panelH   = Math.min(220, Math.max(155, window.innerHeight * 0.26));
  const availH   = window.innerHeight - panelH;

  const targetW  = window.innerWidth * 0.7;
  const targetH  = availH * 0.97;
  const scale    = Math.min(targetW / model.internalModel.width, targetH / model.internalModel.height);

  model.scale.set(scale);

  // Horizontally centered; bottom of model sits at the top of the VN panel
  model.x = (window.innerWidth - model.width) / 2;
  model.y = availH - model.height + model.height * 0.04;

  // Save as home state for camera animations to reference
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
    // Slide off one side, snap to other side, slide back in
    const dir    = fade === 'left' ? -1 : 1;
    const slideX = window.innerWidth * 0.35 * dir;
    animateTo({ x: home.x + slideX, alpha: 0 }, 420, () => {
      model.x     = home.x - slideX;
      model.alpha = 0;
      animateTo({ x: home.x, alpha: 1 }, 420);
    });
    return;
  }

  if (cam === 'face') {
    const panelH = Math.min(220, Math.max(155, window.innerHeight * 0.26));
    const availH = window.innerHeight - panelH;
    const Z      = 1.75;

    const newScaleX = home.scaleX * Z;
    const newScaleY = home.scaleY * Z;
    const newW      = model.internalModel.width  * newScaleX;
    const newH      = model.internalModel.height * newScaleY;

    // Center the face region (approx top 20% of model) in the available viewport
    const targetX = window.innerWidth / 2 - newW / 2;
    const targetY = availH * 0.42 - newH * 0.20;

    animateTo({ x: targetX, y: targetY, scaleX: newScaleX, scaleY: newScaleY }, 650);
    return;
  }

  if (cam === 'full') {
    animateTo({ x: home.x, y: home.y, scaleX: home.scaleX, scaleY: home.scaleY, alpha: 1 }, 650);
  }
}
