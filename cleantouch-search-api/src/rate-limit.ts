export type LimitWindow = 'minute' | 'day' | 'unknown';

export class ProviderRateLimitError extends Error {
  constructor(readonly retryAfterSeconds?: number, readonly limitWindow: LimitWindow = 'unknown') {
    const reason = limitWindow === 'minute' ? 'AI 서비스의 분당 처리량 한도에 도달했습니다.'
      : limitWindow === 'day' ? 'AI 서비스의 일일 사용량 한도에 도달했습니다.'
        : 'AI 서비스의 사용량 한도에 도달했습니다.';
    const wait = retryAfterSeconds === undefined ? ' 잠시 후 다시 시도해 주세요.'
      : ` 약 ${Math.max(1, Math.ceil(retryAfterSeconds))}초 후에 이어서 분석할 수 있습니다.`;
    super(reason + wait);
  }
}

/** Keep account identifiers and raw upstream errors out of the public response. */
export function readRetryAfterSeconds(response: Response, now = Date.now()) {
  const value = response.headers.get('retry-after')?.trim();
  let retryAfterSeconds: number | undefined;
  if (value) {
    if (/^\d+(?:\.\d+)?$/.test(value)) retryAfterSeconds = Math.ceil(Number(value));
    else if (/^[a-z]{3},/i.test(value)) {
      const date = Date.parse(value);
      if (Number.isFinite(date)) retryAfterSeconds = Math.max(0, Math.ceil((date - now) / 1000));
    }
    if (!Number.isSafeInteger(retryAfterSeconds)) retryAfterSeconds = undefined;
  }
  return retryAfterSeconds;
}

/** Keep account identifiers and raw upstream errors out of the public response. */
export function providerRateLimit(response: Response, detail = '', now = Date.now()) {
  const retryAfterSeconds = readRetryAfterSeconds(response, now);
  const limitWindow: LimitWindow = /\b(?:tokens|requests) per day\b/i.test(detail) ? 'day'
    : /\b(?:tokens|requests) per minute\b/i.test(detail) ? 'minute' : 'unknown';
  return new ProviderRateLimitError(retryAfterSeconds, limitWindow);
}

/** Gemini uses google.rpc.RetryInfo and QuotaFailure in addition to Retry-After. */
export function geminiRateLimit(response: Response, payload: unknown) {
  const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  const error = object(object(payload).error);
  const details = Array.isArray(error.details) ? error.details.map(object) : [];
  const waits: number[] = [];
  const headerWait = providerRateLimit(response).retryAfterSeconds;
  if (headerWait !== undefined) waits.push(headerWait);
  const quotaHints: string[] = typeof error.message === 'string' ? [error.message] : [];
  for (const detail of details) {
    if (detail['@type'] === 'type.googleapis.com/google.rpc.RetryInfo' && typeof detail.retryDelay === 'string') {
      const duration = /^(\d+(?:\.\d+)?)s$/.exec(detail.retryDelay);
      const seconds = duration ? Math.ceil(Number(duration[1])) : NaN;
      if (Number.isSafeInteger(seconds)) waits.push(seconds);
    }
    if (detail['@type'] === 'type.googleapis.com/google.rpc.QuotaFailure' && Array.isArray(detail.violations)) {
      for (const item of detail.violations) {
        const violation = object(item);
        for (const value of [violation.quotaId, violation.quotaMetric]) if (typeof value === 'string') quotaHints.push(value);
      }
    }
  }
  const hint = quotaHints.join(' ');
  const limitWindow: LimitWindow = /per[\s_-]?day/i.test(hint) ? 'day'
    : /per[\s_-]?minute/i.test(hint) ? 'minute' : 'unknown';
  return new ProviderRateLimitError(waits.length ? Math.max(...waits) : undefined, limitWindow);
}
