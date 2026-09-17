/**
 * Thin client for the optional rag/ Python service (see rag/app.py).
 * Never blocks or breaks triage analysis: any failure or a "none" response just means
 * the caller keeps its existing advice text untouched.
 *
 * The RAG service always tries to answer, but labels how it got there:
 *   - "rag": grounded in rag/corpus/, with citations
 *   - "llm": no corpus match — general LLM knowledge, no citations
 *   - "none": no LLM configured/reachable at all
 */

const RAG_TIMEOUT_MS = 3000;

async function getRagAdvice({ text, urgency }) {
  const ragUrl = process.env.RAG_SERVICE_URL;
  if (!ragUrl) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RAG_TIMEOUT_MS);

    const response = await fetch(`${ragUrl}/rag/advice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, urgency }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) return null;
    const data = await response.json();
    if (!data.advice || data.source === 'none') return null;

    return { advice: data.advice, sources: data.sources || [], source: data.source };
  } catch (err) {
    console.warn('RAG service unreachable or timed out, keeping existing advice:', err.message);
    return null;
  }
}

async function getEducationContent(docId) {
  const ragUrl = process.env.RAG_SERVICE_URL;
  if (!ragUrl) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RAG_TIMEOUT_MS);

    const response = await fetch(`${ragUrl}/rag/topic/${encodeURIComponent(docId)}`, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) return null;
    const data = await response.json();
    if (!data.found) return null;

    return { docId: data.docId, sections: data.sections || [] };
  } catch (err) {
    console.warn('RAG service unreachable or timed out fetching education content:', err.message);
    return null;
  }
}

module.exports = { getRagAdvice, getEducationContent };
