/**
 * Sarvam AI speech services client: speech-to-text (Saaras) and text-to-speech (Bulbul).
 * https://docs.sarvam.ai
 */

const SARVAM_STT_URL = 'https://api.sarvam.ai/speech-to-text';
const SARVAM_TTS_URL = 'https://api.sarvam.ai/text-to-speech';
const SARVAM_TRANSLATE_URL = 'https://api.sarvam.ai/translate';

// Transcribes an audio Buffer using Sarvam's Saaras STT model.
async function speechToText({ buffer, mimeType, filename, languageCode }) {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) {
    return { error: 'Sarvam API key is not configured.', fallback: true };
  }

  const audioBlob = new Blob([buffer], { type: mimeType || 'audio/webm' });
  const formData = new FormData();
  formData.append('file', audioBlob, filename || 'audio.webm');
  formData.append('model', 'saaras:v3');
  formData.append('language_code', languageCode || 'unknown');

  const response = await fetch(SARVAM_STT_URL, {
    method: 'POST',
    headers: { 'api-subscription-key': apiKey },
    body: formData
  });

  const data = await response.json();
  if (!response.ok) {
    return { error: data.message || 'Sarvam AI speech recognition failed.', fallback: true, status: response.status };
  }

  return { transcript: data.transcript || '', language_code: data.language_code || languageCode };
}

// Synthesizes speech for the given text using Sarvam's Bulbul TTS model.
// Returns a base64-encoded WAV string (matching Sarvam's response format) or an error.
async function textToSpeech({ text, languageCode }) {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) {
    return { error: 'Sarvam API key is not configured.', fallback: true };
  }
  if (!text || !text.trim()) {
    return { error: 'Text is required for speech synthesis.' };
  }

  const model = process.env.SARVAM_TTS_MODEL || 'bulbul:v2';
  const speaker = process.env.SARVAM_TTS_SPEAKER || 'anushka';

  const response = await fetch(SARVAM_TTS_URL, {
    method: 'POST',
    headers: {
      'api-subscription-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: text.slice(0, 1500), // Sarvam TTS has a per-request character limit
      target_language_code: languageCode || 'hi-IN',
      speaker,
      model,
      pace: 1.0,
      speech_sample_rate: 22050
    })
  });

  const data = await response.json();
  if (!response.ok) {
    return { error: data.message || 'Sarvam AI speech synthesis failed.', status: response.status };
  }

  const audioBase64 = Array.isArray(data.audios) ? data.audios[0] : null;
  if (!audioBase64) {
    return { error: 'Sarvam AI returned no audio.' };
  }

  return { audioBase64, mimeType: 'audio/wav' };
}

// Translates text (e.g. Hindi/Marathi) into English via Sarvam's translate endpoint.
async function translateToEnglish({ text, sourceLanguageCode }) {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) {
    return { error: 'Sarvam API key is not configured.', fallback: true };
  }

  let srcLang = sourceLanguageCode || 'hi-IN';
  if (!srcLang.includes('-')) srcLang = `${srcLang}-IN`;
  if (srcLang === 'en-IN') return { translatedText: text };

  const response = await fetch(SARVAM_TRANSLATE_URL, {
    method: 'POST',
    headers: { 'api-subscription-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: text, source_language_code: srcLang, target_language_code: 'en-IN', mode: 'formal' })
  });

  const data = await response.json();
  if (!response.ok) {
    return { error: 'Translation failed', fallback: true };
  }
  return { translatedText: data.translated_text || text, sourceLanguageCode: srcLang };
}

module.exports = { speechToText, textToSpeech, translateToEnglish };
