import { createHash } from 'node:crypto';
import { GoogleAuth } from 'google-auth-library';
import { ProviderNotConfiguredError, VisualSearchError } from './provider-errors.js';
import type { ProductMatch, SearchResult, VisualSearchProvider } from './types.js';

type VisionImage = { url?: string };
type VisionPage = {
  url?: string;
  pageTitle?: string;
  fullMatchingImages?: VisionImage[];
  partialMatchingImages?: VisionImage[];
};
type VisionResponse = {
  responses?: Array<{
    error?: { message?: string };
    webDetection?: {
      bestGuessLabels?: Array<{ label?: string }>;
      pagesWithMatchingImages?: VisionPage[];
      visuallySimilarImages?: VisionImage[];
    };
  }>;
};

export class GoogleVisionProvider implements VisualSearchProvider {
  readonly name = 'google';
  readonly configured: boolean;
  private readonly auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });

  constructor(
    private readonly projectId = process.env.GOOGLE_CLOUD_PROJECT?.trim(),
    private readonly apiKey = process.env.GOOGLE_VISION_API_KEY?.trim(),
    private readonly request: typeof fetch = fetch,
  ) {
    this.configured = Boolean(projectId || apiKey);
  }

  async search(image: Buffer): Promise<SearchResult> {
    if (!this.configured) throw new ProviderNotConfiguredError();
    try {
      const authHeaders = this.apiKey ? { 'x-goog-api-key': this.apiKey } : await (async () => {
        const client = await this.auth.getClient();
        return client.getRequestHeaders();
      })();
      const response = await this.request('https://vision.googleapis.com/v1/images:annotate', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'content-type': 'application/json',
          ...(this.projectId && !this.apiKey ? { 'x-goog-user-project': this.projectId } : {}),
        },
        body: JSON.stringify({
          requests: [{
            image: { content: image.toString('base64') },
            features: [
              { type: 'WEB_DETECTION', maxResults: 12 },
              { type: 'LOGO_DETECTION', maxResults: 5 },
            ],
          }],
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new VisualSearchError(`Vision API request failed with ${response.status}`);
      const payload = await response.json() as VisionResponse;
      const result = payload.responses?.[0];
      if (result?.error?.message) throw new VisualSearchError(result.error.message);
      const detection = result?.webDetection;
      const queryLabel = detection?.bestGuessLabels?.[0]?.label?.trim() || '검색한 상품';
      const pages = detection?.pagesWithMatchingImages ?? [];
      const matches = uniqueMatches(pages, queryLabel).slice(0, 10);
      return { queryLabel, matches };
    } catch (error) {
      if (error instanceof VisualSearchError) throw error;
      throw new VisualSearchError(error instanceof Error ? error.message : 'Vision API request failed');
    }
  }
}

function uniqueMatches(pages: VisionPage[], fallbackTitle: string): ProductMatch[] {
  const seen = new Set<string>();
  const matches: ProductMatch[] = [];
  for (const page of pages) {
    if (!page.url || seen.has(page.url)) continue;
    const parsed = safeUrl(page.url);
    if (!parsed || !['http:', 'https:'].includes(parsed.protocol)) continue;
    seen.add(page.url);
    const exact = Boolean(page.fullMatchingImages?.length);
    matches.push({
      id: createHash('sha256').update(page.url).digest('hex').slice(0, 16),
      title: cleanTitle(page.pageTitle) || fallbackTitle,
      source: parsed.hostname.replace(/^www\./, ''),
      url: page.url,
      imageUrl: page.fullMatchingImages?.[0]?.url ?? page.partialMatchingImages?.[0]?.url,
      matchKind: exact ? 'exact_image' : 'partial_image',
    });
  }
  return matches;
}

function safeUrl(value: string) {
  try { return new URL(value); } catch { return null; }
}

function cleanTitle(value?: string) {
  return value?.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 160);
}

export { VisualSearchError, ProviderNotConfiguredError, ProviderUnavailableError, ProviderRateLimitError } from './provider-errors.js';
