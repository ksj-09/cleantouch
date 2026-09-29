import { ProviderNotConfiguredError, ProviderRateLimitError, VisualSearchError } from './vision-provider.js';
import { parseSceneResult, PRODUCT_PROMPT, SCENE_PROMPT } from './gemini-provider.js';
import type { SearchResult, VisualSearchProvider } from './types.js';
import sharp from 'sharp';
import { providerRateLimit } from './rate-limit.js';

type GroqResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
};

type GroqContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

const DEFAULT_MODEL = 'qwen/qwen3.8-27b';

/**
 * Reads a product from a captured image with Groq's OpenAI-compatible vision API.
 * The model returns only product evidence; shopping links are generated locally.
 */
export class GroqVisionProvider implements VisualSearchProvider {
  readonly name = 'groq';
  readonly configured: boolean;

  constructor(
    private readonly apiKey = process.env.GROQ_API_KEY?.trim(),
    readonly model = process.env.GROQ_MODEL?.trim() || DEFAULT_MODEL,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.configured = Boolean(apiKey);
  }

  async search(image: Buffer, detailImages: Buffer[] = []): Promise<SearchResult> {
    if (!this.apiKey) throw new ProviderNotConfiguredError();

    const hasSelectedFocus = detailImages.length > 0;
    const views = hasSelectedFocus ? [image, detailImages[0]!] : [image];
    if (!hasSelectedFocus) {
      const contentZoom = await createZoom(image, 0.82, 0.58, 0.5, 0.43);
      if (contentZoom) views.push(contentZoom);
    }
    const content: GroqContentPart[] = [
      { type: 'text' as const, text: hasSelectedFocus ? PRODUCT_PROMPT : SCENE_PROMPT },
      ...views.slice(0, 2).map((view) => ({
        type: 'image_url' as const,
        image_url: { url: `data:image/jpeg;base64,${view.toString('base64')}` },
      })),
    ];

    let lastError: GroqAttemptError | undefined;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.searchOnce(content);
      } catch (error) {
        if (error instanceof ProviderRateLimitError) throw error;
        const normalized = error instanceof GroqAttemptError
          ? error
          : new GroqAttemptError(error instanceof Error ? error.message : 'Groq 연결에 실패했습니다.', true);
        lastError = normalized;
        if (!normalized.retryable || attempt === 1) break;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    throw new VisualSearchError(lastError?.message || 'Groq 상품 검색에 실패했습니다.');
  }

  private async searchOnce(content: GroqContentPart[]): Promise<SearchResult> {
    let response: Response;
    try {
      response = await this.fetchImpl('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{
            role: 'user',
            content,
          }],
          temperature: 0.1,
          max_completion_tokens: 4096,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      throw new GroqAttemptError(error instanceof Error ? error.message : 'Groq 연결에 실패했습니다.', true);
    }

    const rawBody = await response.text();
    if (response.status === 429) {
      let detail = '';
      try {
        const body = JSON.parse(rawBody) as GroqResponse;
        if (typeof body?.error?.message === 'string') detail = body.error.message;
      } catch { /* A rate-limited response can also have an empty or HTML body. */ }
      throw providerRateLimit(response, detail);
    }
    let payload: GroqResponse;
    try {
      payload = JSON.parse(rawBody) as GroqResponse;
    } catch {
      throw new GroqAttemptError('Groq 응답을 해석할 수 없습니다.', true);
    }
    if (!response.ok) {
      const detail = payload.error?.message?.slice(0, 240) || `HTTP ${response.status}`;
      throw new GroqAttemptError(`Groq 요청 실패: ${detail}`, response.status >= 500);
    }

    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!text) throw new GroqAttemptError('Groq가 상품 정보를 반환하지 않았습니다.', true);
    try {
      return parseSceneResult(text);
    } catch (error) {
      if (error instanceof VisualSearchError) throw new GroqAttemptError(error.message, true);
      throw error;
    }
  }
}

class GroqAttemptError extends VisualSearchError {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
  }
}

async function createZoom(image: Buffer, widthRatio: number, heightRatio: number, centerX: number, centerY: number) {
  const metadata = await sharp(image).metadata();
  if (!metadata.width || !metadata.height) return undefined;
  const width = Math.max(1, Math.round(metadata.width * widthRatio));
  const height = Math.max(1, Math.round(metadata.height * heightRatio));
  const left = Math.min(metadata.width - width, Math.max(0, Math.round(metadata.width * centerX - width / 2)));
  const top = Math.min(metadata.height - height, Math.max(0, Math.round(metadata.height * centerY - height / 2)));
  return sharp(image)
    .extract({
      left,
      top,
      width,
      height,
    })
    .resize({ width: 1100, height: 1100, fit: 'inside', withoutEnlargement: false })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}
