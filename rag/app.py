"""
RAG advice service: grounds triage advice in rag/corpus/ via retrieval, and refuses to
generate an answer when nothing relevant is found (rather than letting the LLM guess).

Run with: uvicorn app:app --port 8001 --reload
Requires rag/index/ to exist — build it first with `python ingest.py`.
"""

import json
import os
import re
from pathlib import Path
from typing import List, Optional

import faiss
import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

load_dotenv()

INDEX_DIR = Path(__file__).parent / "index"
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
TOP_K = 3
SIMILARITY_THRESHOLD = float(os.environ.get("RAG_SIMILARITY_THRESHOLD", "0.35"))
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "google/gemini-2.5-flash")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# Medicine/drug names the generated advice must never introduce (mirrors the "no
# medicines" rule already enforced in backend/llm/openrouter.js's prompt).
DISALLOWED_DRUG_TERMS = [
    "paracetamol", "aspirin", "ibuprofen", "antibiotic", "amoxicillin",
    "azithromycin", "acetaminophen", "diclofenac", "cetirizine", "ors tablet",
]

app = FastAPI(title="Apex Zenith RAG Advice Service")

_model = None
_index = None
_chunks = None


def get_model():
    global _model
    if _model is None:
        _model = SentenceTransformer(EMBEDDING_MODEL)
    return _model


def get_index_and_chunks():
    global _index, _chunks
    if _index is None:
        if not (INDEX_DIR / "faiss.index").exists():
            raise RuntimeError("RAG index not found — run `python ingest.py` first.")
        _index = faiss.read_index(str(INDEX_DIR / "faiss.index"))
        _chunks = json.loads((INDEX_DIR / "chunks.json").read_text(encoding="utf-8"))
    return _index, _chunks


class AdviceRequest(BaseModel):
    text: str
    urgency: Optional[str] = None


class Source(BaseModel):
    docId: str
    title: str


class AdviceResponse(BaseModel):
    grounded: bool
    advice: Optional[str] = None
    sources: List[Source] = []


def retrieve(query: str, top_k: int = TOP_K):
    index, chunks = get_index_and_chunks()
    model = get_model()
    query_vec = model.encode([query], convert_to_numpy=True, normalize_embeddings=True).astype("float32")
    scores, indices = index.search(query_vec, top_k)
    results = []
    for score, idx in zip(scores[0], indices[0]):
        if idx == -1:
            continue
        results.append({**chunks[idx], "score": float(score)})
    return results


def strip_disallowed_medicines(text: str) -> str:
    """Second safety net: drop any sentence naming a specific drug the context didn't mention."""
    sentences = re.split(r"(?<=[.!?])\s+", text)
    kept = [s for s in sentences if not any(term in s.lower() for term in DISALLOWED_DRUG_TERMS)]
    return " ".join(kept).strip()


def generate_grounded_advice(query: str, hits: List[dict]) -> Optional[str]:
    if not OPENROUTER_API_KEY:
        return None

    context = "\n\n".join(f"[{h['citation']}]\n{h['text']}" for h in hits)
    system_prompt = (
        "You are a clinical guidance assistant for ASHA health workers. Answer ONLY using facts "
        "explicitly stated in the CONTEXT below. Do not add information, medicines, or dosages that "
        "are not present in the context. Cite the bracketed source tag after every claim you make. "
        "If the context does not address the patient's situation, respond with exactly: NOT_GROUNDED"
    )
    user_prompt = f"CONTEXT:\n{context}\n\nPATIENT SITUATION: {query}\n\nGive 1-3 sentences of grounded, cited advice."

    import urllib.request

    payload = json.dumps({
        "model": OPENROUTER_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.0,
        "max_tokens": 300,
    }).encode("utf-8")

    req = urllib.request.Request(
        OPENROUTER_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        content = data["choices"][0]["message"]["content"].strip()
    except Exception:
        return None

    if not content or "NOT_GROUNDED" in content:
        return None

    return strip_disallowed_medicines(content)


@app.post("/rag/advice", response_model=AdviceResponse)
def get_advice(req: AdviceRequest):
    text = (req.text or "").strip()
    if not text:
        return AdviceResponse(grounded=False)

    hits = retrieve(text)
    if not hits or hits[0]["score"] < SIMILARITY_THRESHOLD:
        return AdviceResponse(grounded=False)

    advice = generate_grounded_advice(text, hits)
    if not advice:
        return AdviceResponse(grounded=False)

    sources = [Source(docId=h["doc_id"], title=h["title"]) for h in hits if h["score"] >= SIMILARITY_THRESHOLD]
    return AdviceResponse(grounded=True, advice=advice, sources=sources)


@app.get("/health")
def health():
    try:
        get_index_and_chunks()
        return {"status": "online", "index": "loaded"}
    except Exception as e:
        return {"status": "online", "index": "missing", "detail": str(e)}
