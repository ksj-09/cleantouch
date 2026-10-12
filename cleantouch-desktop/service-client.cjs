// The desktop never holds an operator API key. All AI requests use the configured
// public endpoint; report useful failures even when an upstream proxy returns HTML.
async function requestAi(baseUrl, payload, { signal, timeoutMs = 55000, request = fetch } = {}) {
  const deadline = AbortSignal.timeout(timeoutMs);
  const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;
  try {
    const response = await request(`${baseUrl.replace(/\/$/, '')}/v1/place-chat`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload), signal: combined,
    });
    let body;
    try { body = await response.json(); } catch { body = null; }
    if (!response.ok) {
      const fallback = response.status === 429
        ? 'AI 요청이 잠시 몰렸어요. 잠시 기다린 뒤 다시 시도해 주세요.'
        : 'AI 서비스 연결이 지연되고 있어요. 잠시 뒤 다시 시도해 주세요.';
      const message = typeof body?.message === 'string' ? body.message.slice(0, 400) : fallback;
      const wait = Number(body?.retryAfterSeconds || response.headers?.get('retry-after'));
      throw new Error(message + (Number.isFinite(wait) && wait > 0 ? ` (${Math.ceil(wait)}초 뒤 다시 시도)` : ''));
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new Error('AI 응답을 읽지 못했어요. 질문을 다시 보내 주세요.');
    }
    return body;
  } catch (error) {
    if (signal?.aborted) throw new Error('요청을 취소했어요.');
    if (deadline.aborted || error.name === 'TimeoutError') throw new Error('AI 응답이 늦어졌어요. 잠시 후 다시 시도해 주세요.');
    if (error instanceof TypeError) throw new Error('AI에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.');
    throw error;
  }
}
module.exports = { requestAi };
