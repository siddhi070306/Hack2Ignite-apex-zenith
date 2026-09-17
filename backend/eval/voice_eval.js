/**
 * Evaluation harness for the voice pipeline, mirroring rag/eval.py's approach in this
 * repo: a deterministic check that always runs with no keys, plus a keys-required
 * quality check that explicitly reports "skipped" rather than silently passing.
 *
 * Run with: node eval/voice_eval.js   (from backend/), or `node backend/eval/voice_eval.js`
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { fallbackClinicalAnalysis } = require('../llm/openrouter');
const { textToSpeech, speechToText } = require('../llm/sarvam');

// ---- Part 1: text-only golden set (always runs, no keys needed) -----------------
// Proves the deterministic rule-based analyzer — the same one used when no
// OPENROUTER_API_KEY is set — tolerates the kind of noisy, disfluent output real STT
// actually produces (filler words, repetition, code-switching), not just clean text.
const GOLDEN_SET = [
  { text: 'chest pain and difficulty breathing', expectedUrgency: 'Red' },
  {
    text: 'umm the patient has umm chest pain and, and breathing problem, breathing problem',
    expectedUrgency: 'Red',
    note: 'filler words + repetition (English)'
  },
  { text: 'बुखार है और उल्टी हो रही है', expectedUrgency: 'Yellow', note: 'fever + vomiting (Hindi)' },
  {
    text: 'बुखार बुखार ना, बहुत तेज बुखार है, बहुत तेज बुखार',
    expectedUrgency: 'Yellow',
    note: 'heavy repetition/disfluency (Hindi fever)'
  },
  {
    text: 'patient ko fever hai aur ulti bhi ho rahi hai',
    expectedUrgency: 'Yellow',
    note: 'code-switched Hindi-English — matches via "fever"; "ulti" (romanized) is not in the keyword list, a real gap this harness deliberately surfaces rather than hides'
  },
  { text: 'mild sore throat since this morning, this morning', expectedUrgency: 'Green', note: 'repetition, mild' },
  {
    text: 'thoda thoda khansi hai bas',
    expectedUrgency: 'Green',
    note: 'romanized Hindi cough — engine has no keyword match at all here, so it falls back to a safe Green default rather than the specific symptom; documents a known limitation (no romanized-Hindi support), not a false pass'
  },
];

function runTextEval() {
  console.log('--- Text-only golden set (analysis-layer robustness to noisy transcripts) ---');
  let failures = 0;
  for (const { text, expectedUrgency, note } of GOLDEN_SET) {
    const result = fallbackClinicalAnalysis(text, 'hi');
    const pass = result.urgency === expectedUrgency;
    if (!pass) failures++;
    console.log(`[${pass ? 'PASS' : 'FAIL'}] expected=${expectedUrgency} got=${result.urgency}${note ? ' (' + note + ')' : ''} :: "${text}"`);
  }
  console.log(`${GOLDEN_SET.length - failures}/${GOLDEN_SET.length} passed.\n`);
  return failures === 0;
}

// ---- Part 2: reverse-ASR TTS pronunciation check (needs SARVAM_API_KEY) ---------
// Synthesizes known sentences, feeds the audio back through STT, and checks word
// overlap against the original — a crude but effective way to catch garbled/mispronounced
// TTS output before it reaches an ASHA worker in the field.
const TTS_CHECK_SENTENCES = [
  'Please rest and drink plenty of fluids.',
  'Refer the patient to the nearest hospital immediately.',
  'Keep the child warm and continue breastfeeding.',
];

function wordOverlapRatio(original, reverseAsrText) {
  const clean = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  const originalWords = clean(original);
  const reverseWords = new Set(clean(reverseAsrText));
  if (originalWords.length === 0) return 0;
  const matched = originalWords.filter((w) => reverseWords.has(w)).length;
  return matched / originalWords.length;
}

async function runReverseAsrEval() {
  console.log('--- Reverse-ASR TTS pronunciation check ---');
  if (!process.env.SARVAM_API_KEY) {
    console.log('SKIPPED — no SARVAM_API_KEY configured. This check needs real Sarvam TTS+STT calls to mean anything (a "pass" with no key would be meaningless, so we report skipped instead).\n');
    return true;
  }

  let failures = 0;
  for (const sentence of TTS_CHECK_SENTENCES) {
    try {
      const ttsResult = await textToSpeech({ text: sentence, languageCode: 'en-IN' });
      if (ttsResult.error || !ttsResult.audioBase64) {
        console.log(`[FAIL] TTS synthesis failed for: "${sentence}" (${ttsResult.error})`);
        failures++;
        continue;
      }

      const buffer = Buffer.from(ttsResult.audioBase64, 'base64');
      const sttResult = await speechToText({ buffer, mimeType: 'audio/wav', filename: 'check.wav', languageCode: 'en-IN' });
      if (sttResult.error || !sttResult.transcript) {
        console.log(`[FAIL] Reverse STT failed for: "${sentence}" (${sttResult.error})`);
        failures++;
        continue;
      }

      const overlap = wordOverlapRatio(sentence, sttResult.transcript);
      const pass = overlap >= 0.6;
      if (!pass) failures++;
      console.log(`[${pass ? 'PASS' : 'FAIL'}] overlap=${overlap.toFixed(2)} original="${sentence}" reverseAsr="${sttResult.transcript}"`);
    } catch (err) {
      console.log(`[FAIL] Error checking "${sentence}": ${err.message}`);
      failures++;
    }
  }
  console.log(`${TTS_CHECK_SENTENCES.length - failures}/${TTS_CHECK_SENTENCES.length} passed.\n`);
  return failures === 0;
}

(async () => {
  const textPass = runTextEval();
  const reverseAsrPass = await runReverseAsrEval();
  if (!textPass || !reverseAsrPass) {
    process.exitCode = 1;
  }
})();
