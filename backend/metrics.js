/**
 * Tiny in-memory latency tracker for the voice pipeline (STT/TTS/analysis).
 * Keeps a rolling window per stage — no external metrics infra, just enough
 * visibility to see whether a stage is drifting outside its expected budget.
 */

const WINDOW_SIZE = 50;
const samples = new Map(); // stage -> number[] (most recent first)

function record(stage, ms) {
  if (!samples.has(stage)) samples.set(stage, []);
  const list = samples.get(stage);
  list.unshift(ms);
  if (list.length > WINDOW_SIZE) list.length = WINDOW_SIZE;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx];
}

function getStats(stage) {
  const list = samples.get(stage) || [];
  const sorted = [...list].sort((a, b) => a - b);
  return {
    count: list.length,
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
  };
}

function getAllStats() {
  const result = {};
  for (const stage of samples.keys()) {
    result[stage] = getStats(stage);
  }
  return result;
}

// Wraps an async function call, recording its duration under `stage` regardless of outcome.
async function timed(stage, fn) {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    record(stage, Date.now() - start);
  }
}

module.exports = { record, getStats, getAllStats, timed };
