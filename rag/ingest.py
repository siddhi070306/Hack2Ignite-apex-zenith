"""
Builds rag/index/chunks.json from the markdown corpus in rag/corpus/.

Each corpus file is chunked on its `## ` headings — every section becomes one
citable chunk (`<filename> § <heading>`). Run this whenever the corpus changes:

    python ingest.py

TF-IDF vectorization happens at query time in app.py (fit once at process startup,
cached in memory) rather than here — for a corpus this size (dozens of chunks) that
fit is a few milliseconds, and it means this index has no binary/pickle artifacts
that could go stale against a different scikit-learn version (important since this
service targets both local runs and Vercel's Python runtime).
"""

import json
import re
from pathlib import Path

CORPUS_DIR = Path(__file__).parent / "corpus"
INDEX_DIR = Path(__file__).parent / "index"

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

    INDEX_DIR.mkdir(exist_ok=True)
    (INDEX_DIR / "chunks.json").write_text(json.dumps(chunks, indent=2), encoding="utf-8")

    print(f"Chunked {len(doc_files)} documents into {len(chunks)} sections -> {INDEX_DIR / 'chunks.json'}")


if __name__ == "__main__":
    build_index()
