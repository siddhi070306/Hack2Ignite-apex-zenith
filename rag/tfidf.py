"""
Minimal, dependency-light TF-IDF + cosine similarity retriever.

Deliberately hand-rolled instead of using scikit-learn/scipy: for a corpus this size
(dozens to low hundreds of short chunks), a dense numpy implementation is a few KB of
vectors, has no compiled-library footprint beyond numpy itself, and keeps the whole
rag/ service comfortably under Vercel's Python function size limit.
"""

import re
from collections import Counter

import numpy as np

TOKEN_RE = re.compile(r"[a-zA-Z]+")

STOPWORDS = frozenset("""
a an the this that these those is are was were be been being have has had do does did
to of in on at for with by from as it its it's he she they them his her their and or
but if then than so not no nor very can could should would may might will shall about
into over under again further once here there when where why how all any both each
few more most other some such only own same too also i you we your yours mine our
ours my me him her hers himself herself itself themselves what which who whom
good well nice great bad advise advised advises encourage encouraged encourages
""".split())


def tokenize(text: str):
    return [t.lower() for t in TOKEN_RE.findall(text) if t.lower() not in STOPWORDS and len(t) > 1]


class TfidfIndex:
    def __init__(self):
        self.vocab = {}  # token -> column index
        self.idf = None  # (V,) array
        self.doc_vectors = None  # (N, V) L2-normalized TF-IDF matrix

    def fit(self, documents):
        """documents: list[str]. Builds vocabulary, IDF, and normalized document vectors."""
        tokenized = [tokenize(doc) for doc in documents]

        doc_freq = Counter()
        for tokens in tokenized:
            doc_freq.update(set(tokens))

        self.vocab = {term: i for i, term in enumerate(sorted(doc_freq))}
        n_docs = len(documents)
        vocab_size = len(self.vocab)

        # Smoothed IDF: log((1 + N) / (1 + df)) + 1 — always positive, matches sklearn's default.
        df_array = np.zeros(vocab_size, dtype=np.float64)
        for term, idx in self.vocab.items():
            df_array[idx] = doc_freq[term]
        self.idf = np.log((1 + n_docs) / (1 + df_array)) + 1.0

        matrix = np.zeros((n_docs, vocab_size), dtype=np.float64)
        for row, tokens in enumerate(tokenized):
            term_counts = Counter(tokens)
            for term, count in term_counts.items():
                col = self.vocab.get(term)
                if col is not None:
                    matrix[row, col] = count

        matrix *= self.idf
        self.doc_vectors = self._normalize_rows(matrix)

    def _vectorize_query(self, text: str) -> np.ndarray:
        tokens = tokenize(text)
        vec = np.zeros(len(self.vocab), dtype=np.float64)
        for term, count in Counter(tokens).items():
            col = self.vocab.get(term)
            if col is not None:
                vec[col] = count
        vec *= self.idf
        norm = np.linalg.norm(vec)
        return vec / norm if norm > 0 else vec

    @staticmethod
    def _normalize_rows(matrix: np.ndarray) -> np.ndarray:
        norms = np.linalg.norm(matrix, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        return matrix / norms

    def search(self, query: str, top_k: int = 3, min_overlap: int = 2):
        """Returns a list of (index, score) sorted by descending cosine similarity.

        Requires at least `min_overlap` distinct vocabulary terms shared between the
        query and a chunk before it counts as a candidate — with short chunks, a single
        incidental shared word (e.g. "apply", "listen") can otherwise produce a
        deceptively high cosine score with no real topical relevance.
        """
        if self.doc_vectors is None or len(self.vocab) == 0:
            return []

        # The adaptive floor below is based on the RAW query length, not how many of its
        # terms happen to exist in the corpus vocabulary — otherwise a query with mostly
        # out-of-vocabulary words (e.g. "apply for a passport", where only "apply" is a
        # corpus term) would incorrectly relax to requiring just 1 match.
        raw_terms = tokenize(query)
        if not raw_terms:
            return []
        required_overlap = min(min_overlap, len(set(raw_terms)))

        query_terms_in_vocab = {t for t in raw_terms if t in self.vocab}
        if not query_terms_in_vocab:
            return []
        term_indices = np.array(sorted(self.vocab[t] for t in query_terms_in_vocab))

        query_vec = self._vectorize_query(query)
        scores = self.doc_vectors @ query_vec

        candidates = []
        for i in range(len(scores)):
            if scores[i] <= 0:
                continue
            overlap = int(np.count_nonzero(self.doc_vectors[i, term_indices]))
            if overlap < required_overlap:
                continue
            candidates.append((i, float(scores[i])))

        candidates.sort(key=lambda pair: pair[1], reverse=True)
        return [(int(i), score) for i, score in candidates[:top_k]]
