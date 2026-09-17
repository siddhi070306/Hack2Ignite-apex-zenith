"""
Builds the FAISS retrieval index from the markdown corpus in rag/corpus/.

Each corpus file is chunked on its `## ` headings — every section becomes one
citable chunk (`<filename> § <heading>`). Run this whenever the corpus changes:

    python ingest.py

Produces rag/index/faiss.index (vectors) and rag/index/chunks.json (chunk
text + citation metadata, in the same order as the vectors).
"""

import json
import re
from pathlib import Path

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

CORPUS_DIR = Path(__file__).parent / "corpus"
INDEX_DIR = Path(__file__).parent / "index"
EMBEDDING_MODEL = "all-MiniLM-L6-v2"

HEADING_RE = re.compile(r"^##\s+(.*)$", re.MULTILINE)


def chunk_file(path: Path):
    """Split a markdown file into (heading, body) sections on '## ' headings."""
    text = path.read_text(encoding="utf-8")
    matches = list(HEADING_RE.finditer(text))
    chunks = []
    for i, match in enumerate(matches):
        heading = match.group(1).strip()
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[start:end].strip()
        if body:
            chunks.append((heading, body))
    return chunks


def build_index():
    doc_files = sorted(p for p in CORPUS_DIR.glob("*.md") if p.name != "README.md")
    if not doc_files:
        raise SystemExit(f"No corpus documents found in {CORPUS_DIR}")

    chunks = []
    for path in doc_files:
        doc_id = path.stem
        for heading, body in chunk_file(path):
            chunks.append({
                "doc_id": doc_id,
                "title": heading,
                "citation": f"{doc_id} § {heading}",
                "text": body,
            })

    print(f"Chunked {len(doc_files)} documents into {len(chunks)} sections.")

    model = SentenceTransformer(EMBEDDING_MODEL)
    embeddings = model.encode(
        [c["text"] for c in chunks],
        convert_to_numpy=True,
        normalize_embeddings=True,  # so inner product == cosine similarity
        show_progress_bar=True,
    ).astype("float32")

    index = faiss.IndexFlatIP(embeddings.shape[1])
    index.add(embeddings)

    INDEX_DIR.mkdir(exist_ok=True)
    faiss.write_index(index, str(INDEX_DIR / "faiss.index"))
    (INDEX_DIR / "chunks.json").write_text(json.dumps(chunks, indent=2), encoding="utf-8")

    print(f"Wrote index for {len(chunks)} chunks to {INDEX_DIR}")


if __name__ == "__main__":
    build_index()
