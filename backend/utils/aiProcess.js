const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const AI_ROOT = path.resolve(__dirname, '..', '..', 'ai');
const APP_PY = path.join(AI_ROOT, 'api', 'app.py');
const MODEL_DIR = path.join(AI_ROOT, 'model');

const PYTHON_BIN = process.env.PYTHON_BIN || 'python3';
const AI_API_PORT = process.env.AI_API_PORT || '5001';

let child = null;
let restartCount = 0;
const MAX_RESTARTS = 5;

function modelIsTrained() {
  return (
    fs.existsSync(path.join(MODEL_DIR, 'tfidf_vectorizer.pkl')) &&
    fs.existsSync(path.join(MODEL_DIR, 'intent_classifier.pkl'))
  );
}

function startAIProcess() {
  if (process.env.SKIP_AI_PROCESS === 'true') {
    console.log('[ai] SKIP_AI_PROCESS=true — not starting the local model API.');
    return;
  }
  if (!fs.existsSync(APP_PY)) {
    console.warn(`[ai] ${APP_PY} not found — skipping local model API. /api/ai/* will 503.`);
    return;
  }
  if (!modelIsTrained()) {
    console.warn(
      '[ai] Model not trained yet (missing ai/model/*.pkl). Run `python ai/training/train.py` first. /api/ai/* will 503 until then.'
    );
  }

  child = spawn(PYTHON_BIN, [APP_PY], {
    cwd: AI_ROOT,
    env: { ...process.env, AI_API_PORT },
    stdio: 'pipe',
  });

  child.stdout.on('data', (d) => process.stdout.write(`[ai] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`[ai] ${d}`));

  child.on('exit', (code, signal) => {
    console.warn(`[ai] model API exited (code=${code}, signal=${signal}).`);
    child = null;
    if (restartCount < MAX_RESTARTS) {
      restartCount += 1;
      console.warn(`[ai] restarting model API (attempt ${restartCount}/${MAX_RESTARTS}) in 2s...`);
      setTimeout(startAIProcess, 2000);
    } else {
      console.error('[ai] model API kept crashing — giving up. /api/ai/* will 503.');
    }
  });

  console.log(`[ai] local model API starting on port ${AI_API_PORT} (pid ${child.pid}).`);
}

function stopAIProcess() {
  if (child) {
    child.kill();
    child = null;
  }
}

module.exports = { startAIProcess, stopAIProcess };
