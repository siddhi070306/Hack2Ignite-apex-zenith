"""
Proves the non-hallucination gate actually works: in-corpus queries must come back
grounded with citations, and clearly out-of-scope queries must be rejected rather than
answered. Run the retrieval layer directly (no server/network needed):

    python eval.py

This only exercises retrieval + the similarity gate, not the OpenRouter generation call
(which needs OPENROUTER_API_KEY and network access) — that's the part worth testing
without any external dependency, since it's the actual safety mechanism.
"""

from app import retrieve, SIMILARITY_THRESHOLD

IN_SCOPE_QUERIES = [
    "the patient has severe chest pain radiating to the left arm and is sweating",
    "child is having convulsions and will not wake up",
    "patient has watery diarrhea and sunken eyes, very weak",
    "mild sore throat and runny nose since this morning, no fever",
    "pregnant woman with severe headache blurred vision and swelling of the face",
    "newborn baby is not feeding and feels very cold to touch",
    "deep burn on the arm from boiling water",
    "snake bite on the leg, patient having difficulty breathing",
    "child looks very thin with swelling in both feet",
    "high fever with severe joint pain and swelling in wrists and ankles",
    "cough for three weeks with blood in the sputum and weight loss",
    "elderly patient suddenly confused and drowsy since this morning",
    "patient expressing thoughts of wanting to end their life",
    "known diabetic patient is sweating heavily and confused",
]

OUT_OF_SCOPE_QUERIES = [
    "what is the weather forecast for tomorrow",
    "how do I reset my phone's factory settings",
    "recommend a good recipe for biryani",
    "what is the capital of France",
    "who won the cricket match yesterday",
    "how do I apply for a passport",
    "best songs to listen to while driving",
    "what time does the train to Mumbai leave",
]


def run():
    failures = []

    print("--- In-scope queries (expect grounded=True) ---")
    for q in IN_SCOPE_QUERIES:
        hits = retrieve(q)
        best = hits[0]["score"] if hits else 0.0
        grounded = best >= SIMILARITY_THRESHOLD
        status = "PASS" if grounded else "FAIL"
        if not grounded:
            failures.append(q)
        top_citation = hits[0]["citation"] if hits else "none"
        print(f"[{status}] score={best:.3f} citation='{top_citation}' :: {q}")

    print("\n--- Out-of-scope queries (expect grounded=False) ---")
    for q in OUT_OF_SCOPE_QUERIES:
        hits = retrieve(q)
        best = hits[0]["score"] if hits else 0.0
        grounded = best >= SIMILARITY_THRESHOLD
        status = "PASS" if not grounded else "FAIL"
        if grounded:
            failures.append(q)
        print(f"[{status}] score={best:.3f} :: {q}")

    print(f"\n{len(IN_SCOPE_QUERIES) + len(OUT_OF_SCOPE_QUERIES) - len(failures)}/"
          f"{len(IN_SCOPE_QUERIES) + len(OUT_OF_SCOPE_QUERIES)} passed.")
    if failures:
        print("FAILED cases:")
        for f in failures:
            print(f"  - {f}")
        raise SystemExit(1)


if __name__ == "__main__":
    run()
