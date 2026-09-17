# Apex Zenith (ASHA Mitra)

AI-powered voice triage assistant for ASHA/ANM health workers in rural India — voice-based symptom intake, AI urgency classification, hospital/clinic locator, and tamper-evident record anchoring.

## Features

- **Voice triage**: record symptoms by voice (Hindi/Marathi/English UI, extendable to more languages), live browser transcription with a Sarvam AI (Saaras) speech-to-text fallback for full accuracy.
- **AI urgency classification**: OpenRouter LLM (default `google/gemini-2.5-flash`) extracts symptoms/keywords and assigns a Red/Yellow/Green urgency tier, with a deterministic rule-based fallback when no API key is configured.
- **Spoken advice playback**: triage advice can be read aloud via Sarvam AI's Bulbul text-to-speech.
- **Hospital/clinic locator**: live nearby facility search (OpenStreetMap Overpass + Nominatim) on a Leaflet map, auto-surfaced for Red-urgency cases.
- **Tamper-evident records**: each triage record is SHA-256 hashed and anchored with a simulated blockchain receipt (see `blockchain/` for the real Polygon contract + deploy path).
- **Doctor verification workflow**: doctors review AI-extracted triage records, adjust urgency/symptoms, and send a message back to the ASHA worker.
- **Grounded advice (RAG)**: an optional Python service (`rag/`) always tries to answer, but labels how — `rag` (grounded in the corpus, with citations) or `llm` (no corpus match, general knowledge, clearly flagged as such in the UI). Retrieval is a lightweight, dependency-light TF-IDF match (no torch/embeddings) so the whole service stays well under Vercel's Python function size limit. See `rag/corpus/README.md` for the corpus's current status (starter/public-knowledge, not yet clinically reviewed).
- **Offline-first**: works without MongoDB (falls back to local JSON files) and caches data in the browser for offline login/patient/triage access.

## Structure

```
frontend/   React 19 + Vite + Tailwind client
backend/    Express 5 REST API (auth, patients, triage, voice, LLM)
blockchain/ Solidity TriageAnchor contract + Hardhat deploy script
rag/        Python FastAPI service: retrieval-grounded, cited triage advice (optional)
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

### Optional: RAG service (grounded advice)

```bash
cd rag
python -m venv venv && source venv/Scripts/activate   # or venv/bin/activate on macOS/Linux
pip install -r requirements.txt                         # fastapi, uvicorn, numpy, python-dotenv only
cp .env.example .env                                    # reuses OPENROUTER_API_KEY
python ingest.py                                        # rebuilds index/chunks.json from corpus/ (already committed — only needed after editing corpus/)
python eval.py                                           # proves grounded vs correctly-rejected queries (22/22)
uvicorn app:app --port 8001
```

Then set `RAG_SERVICE_URL=http://localhost:8001` in `backend/.env`. If this service isn't running,
`/api/analyze-triage` just falls back to its existing advice — nothing else changes.

`rag/index/chunks.json` is committed to the repo (not gitignored) because Vercel's Python
functions have no build step to run `ingest.py` at deploy time — re-run it locally and commit the
result whenever `rag/corpus/` changes.

## Deployment

`frontend/`, `backend/`, and `rag/` each include their own `vercel.json` for deployment as three
separate Vercel projects. `rag/` deliberately avoids torch/sentence-transformers/FAISS — its
retrieval is a hand-rolled TF-IDF implementation (`rag/tfidf.py`) using only numpy, keeping the
deployed function around 80MB, well under Vercel's 500MB Python function limit (torch alone is
over 1GB, which would not fit). After deploying `rag/`, set `RAG_SERVICE_URL` on the backend
project to the RAG deployment's URL.
