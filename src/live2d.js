import * as PIXI from 'pixi.js';
import { Live2DModel } from 'pixi-live2d-display/cubism4';
import { MODEL_PATH } from './config.js';

// Required: pixi-live2d-display reads PIXI from the global scope.
window.PIXI = PIXI;

let app = null;
let model = null;

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

  // Scale model so it occupies ~65% of viewport width, up to 95% of viewport height.
  const targetW = window.innerWidth * 0.65;
  const targetH = window.innerHeight * 0.95;
  const scale = Math.min(targetW / model.internalModel.width, targetH / model.internalModel.height);

  model.scale.set(scale);

  // Horizontally centered, slightly above viewport bottom so chatbox doesn't fully cover feet.
  model.x = (window.innerWidth - model.width) / 2;
  model.y = window.innerHeight - model.height + model.height * 0.05;
}

function onResize() {
  if (!app) return;
  app.renderer.resize(window.innerWidth, window.innerHeight);
  fitModel();
}

/**
 * Trigger a named expression (e.g. 'happy', 'surprised').
 * Silently ignored if the model doesn't have that expression.
 */
export function setExpression(name) {
  if (!model) return;
  try { model.expression(name); } catch { /* model may not have this expression */ }
}

/**
 * Trigger a named motion group (e.g. 'idle', 'tap_body').
 */
export function setMotion(group) {
  if (!model) return;
  try { model.motion(group); } catch { /* model may not have this motion */ }
}
