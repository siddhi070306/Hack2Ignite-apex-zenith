/**
 * Thin client for the optional rag/ Python service (see rag/app.py).
 * Never blocks or breaks triage analysis: any failure, timeout, or an
 * ungrounded response just means the caller keeps its existing advice text.
 */

const RAG_TIMEOUT_MS = 4000;

async function getGroundedAdvice({ text, urgency }) {
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
    if (!data.grounded) return null;

    return { advice: data.advice, sources: data.sources || [] };
  } catch (err) {
    console.warn('RAG service unreachable or timed out, keeping existing advice:', err.message);
    return null;
  }
}

module.exports = { getGroundedAdvice };
