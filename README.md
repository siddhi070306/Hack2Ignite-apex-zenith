# Apex Zenith (ASHA Mitra)

AI-powered voice triage assistant for ASHA/ANM health workers in rural India — voice-based symptom intake, AI urgency classification, hospital/clinic locator, and tamper-evident record anchoring.

## Features

- **Voice triage**: record symptoms by voice (Hindi/Marathi/English UI, extendable to more languages), live browser transcription with a Sarvam AI (Saaras) speech-to-text fallback for full accuracy.
- **AI urgency classification**: OpenRouter LLM (default `google/gemini-2.5-flash`) extracts symptoms/keywords and assigns a Red/Yellow/Green urgency tier, with a deterministic rule-based fallback when no API key is configured.
- **Spoken advice playback**: triage advice can be read aloud via Sarvam AI's Bulbul text-to-speech.
- **Hospital/clinic locator**: live nearby facility search (OpenStreetMap Overpass + Nominatim) on a Leaflet map, auto-surfaced for Red-urgency cases.
- **Tamper-evident records**: each triage record is SHA-256 hashed and anchored with a simulated blockchain receipt (see `blockchain/` for the real Polygon contract + deploy path).
- **Doctor verification workflow**: doctors review AI-extracted triage records, adjust urgency/symptoms, and send a message back to the ASHA worker.
- **Offline-first**: works without MongoDB (falls back to local JSON files) and caches data in the browser for offline login/patient/triage access.

## Structure

```
frontend/   React 19 + Vite + Tailwind client
backend/    Express 5 REST API (auth, patients, triage, voice, LLM)
blockchain/ Solidity TriageAnchor contract + Hardhat deploy script
```

## Running locally

```bash
npm run install-backend   # backend/npm install
npm run install-frontend  # frontend/npm install

# backend
cp backend/.env.example backend/.env   # fill in API keys as needed
npm start                              # from backend/, or `npm start` at root

# frontend (separate terminal)
cp frontend/.env.example frontend/.env
cd frontend && npm run dev
```

The backend works with no API keys configured — MongoDB falls back to local JSON files, the LLM falls back to a rule-based clinical analyzer, and voice input falls back to the browser's built-in speech recognition. Add `SARVAM_API_KEY` and `OPENROUTER_API_KEY` in `backend/.env` for the full cloud-quality experience.

## Deployment

Both `frontend/` and `backend/` include `vercel.json` for deployment as separate Vercel projects (backend as a serverless function, frontend as a static SPA).
