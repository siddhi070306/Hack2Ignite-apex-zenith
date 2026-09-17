# Corpus disclaimer

The documents in this folder are a **starter, public-knowledge corpus** written to model well-known
community-health-worker triage guidance (IMNCI/WHO-style danger signs, fever/ORS management,
referral criteria, etc.).

**This is not a substitute for reviewed, authoritative clinical protocols.** Before this RAG service
informs any real triage decision, the corpus must be replaced or validated by a qualified clinician
against your local health authority's actual guidelines (e.g. India's IMNCI/RBSK protocols, WHO IMCI,
or your facility's own SOPs).

Until then, treat every grounded answer from this service as a demo of the *retrieval and citation
mechanism*, not as verified medical guidance.

## Format
Each file is one topic. Use `##` headings to mark citable sections — `ingest.py` chunks on headings,
and each chunk's citation is `<filename> § <heading>`.
