export class VisualSearchError extends Error {}

export class ProviderNotConfiguredError extends Error {
  constructor() { super('상품 검색 공급자가 설정되지 않았습니다. 검색 서버 인증 설정을 확인해 주세요.'); }
}

export class ProviderUnavailableError extends VisualSearchError {
  constructor(readonly retryAfterSeconds?: number) {
    const wait = retryAfterSeconds === undefined ? ' 잠시 후 다시 분석해 주세요.'
      : ` 약 ${Math.max(1, retryAfterSeconds)}초 후 다시 분석해 주세요.`;
    super('AI 상품 분석 서비스가 일시적으로 응답하지 않습니다.' + wait);
  }
}

export { ProviderRateLimitError } from './rate-limit.js';
