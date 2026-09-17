/**
 * OpenRouter LLM triage service.
 * Handles keyword extraction, clinical symptom identification, and
 * Green/Yellow/Red urgency classification via the OpenRouter API.
 */

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// High-precision rule-based fallback used when no API key is configured or the LLM call/parse fails.
function fallbackClinicalAnalysis(text, lang = 'hi') {
  const inputStr = (text || '').trim();
  const lower = inputStr.toLowerCase();

  let urgency = 'Green';
  let symptoms = [];
  let advice = '';

  const stopwords = new Set(['है', 'हो', 'था', 'थी', 'रहे', 'रहा', 'रही', 'और', 'का', 'की', 'के', 'में', 'पर', 'से', 'को', 'the', 'and', 'a', 'an', 'in', 'on', 'of', 'for', 'is', 'was', 'have', 'has']);
  const rawWords = inputStr.split(/[\s,।.?!\-]+/)
    .map(w => w.trim())
    .filter(w => w.length > 1 && !stopwords.has(w.toLowerCase()));
  const keywords = Array.from(new Set(rawWords)).slice(0, 6);

  const matchesChest = lower.includes('chest') || lower.includes('छाती') || lower.includes('छातीत') || lower.includes('सीना');
  const matchesPain = lower.includes('दर्द') || lower.includes('दुख') || lower.includes('pain') || lower.includes('पीड़ा') || lower.includes('तकलीफ');
  const matchesBreath = lower.includes('सांस') || lower.includes('श्वास') || lower.includes('breath') || lower.includes('दम');
  const matchesFever = lower.includes('बुखार') || lower.includes('fever') || lower.includes('ताप') || lower.includes('बदन गर्म');
  const matchesHead = lower.includes('सिर') || lower.includes('सर') || lower.includes('डोके') || lower.includes('head');
  const matchesDizzy = lower.includes('चक्कर') || lower.includes('घेरी') || lower.includes('dizzy') || lower.includes('giddiness');
  const matchesVomit = lower.includes('उल्टी') || lower.includes('उलट्या') || lower.includes('vomit') || lower.includes('जी मिचलाना');
  const matchesMotion = lower.includes('जुलाब') || lower.includes('दस्त') || lower.includes('motion') || lower.includes('diarrhea') || lower.includes('पेचिश');
  const matchesStomach = lower.includes('पेट') || lower.includes('पोट') || lower.includes('stomach') || lower.includes('abdomen');
  const matchesWeak = lower.includes('कमजोरी') || lower.includes('अशक्त') || lower.includes('weak') || lower.includes('थकाव') || lower.includes('fatigue');
  const matchesCold = lower.includes('सर्दी') || lower.includes('जुकाम') || lower.includes('cold') || lower.includes('नाक बह');
  const matchesCough = lower.includes('खांसी') || lower.includes('खोकला') || lower.includes('cough');
  const matchesThroat = lower.includes('गला') || lower.includes('घशा') || lower.includes('throat') || lower.includes('खराश');

  let hasRed = false;
  let hasYellow = false;

  if (matchesChest && matchesPain) {
    symptoms.push('Chest Pain / Cardiac Discomfort');
    hasRed = true;
  }
  if (matchesBreath && (matchesPain || lower.includes('तकलीफ') || lower.includes('फूल') || lower.includes('त्रास') || lower.includes('short'))) {
    symptoms.push('Shortness of Breath / Respiratory Distress');
    hasRed = true;
  }
  if (matchesHead && matchesPain) {
    symptoms.push('Headache');
    hasYellow = true;
  }
  if (matchesDizzy) {
    symptoms.push('Dizziness / Giddiness');
    hasYellow = true;
  }
  if (matchesFever) {
    symptoms.push(lower.includes('तेज') || lower.includes('खूप') || lower.includes('high') ? 'High Fever (>102°F)' : 'Fever');
    hasYellow = true;
  }
  if (matchesVomit) {
    symptoms.push('Vomiting / Nausea');
    hasYellow = true;
  }
  if (matchesMotion) {
    symptoms.push('Loose Motions / Diarrhea');
    hasYellow = true;
  }
  if (matchesStomach && matchesPain) {
    symptoms.push('Abdominal Pain');
    hasYellow = true;
  }
  if (matchesWeak) {
    symptoms.push('General Weakness / Lethargy');
    hasYellow = true;
  }
  if (matchesCough) symptoms.push('Cough');
  if (matchesCold) symptoms.push('Cold / Runny Nose');
  if (matchesThroat) symptoms.push('Sore Throat / Throat Irritation');

  if (symptoms.length === 0) {
    if (matchesPain) {
      symptoms.push('Body Pain');
      hasYellow = true;
    } else {
      symptoms.push('General Symptoms');
    }
  }

  if (hasRed) urgency = 'Red';
  else if (hasYellow) urgency = 'Yellow';
  else urgency = 'Green';

  if (urgency === 'Red') {
    advice = 'Immediate emergency referral to District Hospital / CHC. Arrange priority ambulance transport and keep patient resting in a comfortable position.';
  } else if (urgency === 'Yellow') {
    advice = 'Refer patient to Sub-Centre or ANM within 24 hours. Keep patient hydrated with warm fluids/ORS and monitor body temperature.';
  } else {
    advice = 'Advise warm saline gargles, adequate rest, hydration, and home precautions. Monitor symptoms locally for 48 hours.';
  }

  return {
    keywords: keywords.length > 0 ? keywords : ['patient description'],
    symptoms,
    urgency,
    advice,
    translation: inputStr,
    provider: 'ASHA Clinical Engine (High Precision Matcher)'
  };
}

// Main LLM analysis function, calling OpenRouter with a strict clinical-extraction prompt.
async function analyzeSpokenTriage({ text, language = 'hi' }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';

  if (!text || !text.trim()) {
    return {
      keywords: [], symptoms: [], urgency: 'Green',
      advice: 'No speech or text input detected. Please try again.',
      translation: '', provider: 'System'
    };
  }

  if (!apiKey || apiKey === 'your_openrouter_api_key_here') {
    console.warn('⚠️ OPENROUTER_API_KEY missing in backend/.env. Using high-precision clinical fallback.');
    return fallbackClinicalAnalysis(text, language);
  }

  const systemPrompt = `You are a high-precision clinical triage AI assistant for ASHA healthcare workers in India.
Your task is to analyze the patient description (spoken or typed) and extract key information with MAXIMUM ACCURACY.

CRITICAL EXTRACTION RULES:
1. "keywords": Extract ONLY words or short key phrases (3 to 6 items) that are EXACTLY present in the patient description. Do NOT add words that were not present.
2. "symptoms": Extract ONLY standardized medical symptoms that are EXPLICITLY described in the patient description. Do NOT invent, assume, or add unmentioned symptoms.
3. "urgency": Assign strictly based on symptom severity:
   - "Red": Critical emergency symptoms ONLY (e.g., severe chest pain, shortness of breath / breathing difficulty, severe bleeding, loss of consciousness, convulsions, infant fever with lethargy/inability to feed).
   - "Yellow": Moderate risk requiring ANM/Sub-Centre assessment within 24-48 hours (e.g., persistent fever, vomiting, loose motions / diarrhea, abdominal pain, severe headache, dizziness).
   - "Green": Mild symptoms manageable at home (e.g., mild cold, mild sore throat, minor body ache, slight tiredness).
4. "advice": Provide 1-2 clear sentences of precautions, first-aid measures, and health facility referral guidance.
   STRICT RULE FOR ADVICE: DO NOT prescribe or mention any specific medicines or drug dosages (such as Paracetamol, Aspirin, Antibiotics). ONLY recommend preventive care, rest, hydration, home precautions, and hospital/ANM referral.
5. "translation": Provide an accurate, faithful English translation of the exact patient statement.

You MUST return ONLY a raw, valid JSON object matching this schema:
{
  "keywords": ["exact keyword 1", "exact keyword 2"],
  "symptoms": ["Explicit Symptom 1", "Explicit Symptom 2"],
  "urgency": "Red" | "Yellow" | "Green",
  "advice": "Precautions and referral recommendations only. NO medicines.",
  "translation": "English translation of spoken text"
}

Do NOT include any markdown code blocks (\`\`\`json) or extra text outside the JSON.`;

  const userPrompt = `Spoken Language: ${language}\nPatient Description: "${text}"`;

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
        'X-Title': 'Apex Zenith AI Triage',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenRouter API Error Response:', response.status, errorData);
      return fallbackClinicalAnalysis(text, language);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || '';

    let parsed;
    try {
      const cleanedContent = rawContent.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
      parsed = JSON.parse(cleanedContent);
    } catch (parseErr) {
      console.warn('⚠️ OpenRouter response parsing warning. Falling back to precision matcher:', parseErr.message);
      return fallbackClinicalAnalysis(text, language);
    }

    return {
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      symptoms: Array.isArray(parsed.symptoms) ? parsed.symptoms : [],
      urgency: ['Red', 'Yellow', 'Green'].includes(parsed.urgency) ? parsed.urgency : 'Green',
      advice: parsed.advice || 'Advise rest, fluid intake, and monitor symptoms.',
      translation: typeof parsed.translation === 'string' ? parsed.translation : (parsed.translation?.en?.patient_description || parsed.translation?.patient_description || text),
      provider: `OpenRouter (${model})`
    };
  } catch (error) {
    console.error('OpenRouter LLM Triage Error:', error.message);
    return fallbackClinicalAnalysis(text, language);
  }
}

module.exports = { analyzeSpokenTriage, fallbackClinicalAnalysis };
