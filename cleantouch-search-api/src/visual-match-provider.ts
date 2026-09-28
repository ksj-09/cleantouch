import sharp from 'sharp';
import type { ProductMatch, SearchResult, VisualSearchProvider } from './types.js';

/** Adds actual web-image matches for cropped objects while keeping text links as a fallback. */
export class VisualMatchProvider implements VisualSearchProvider {
  readonly name: string;
  readonly model?: string;
  readonly configured: boolean;
  readonly visualMatchesConfigured = true;

  constructor(
    private readonly recognizer: VisualSearchProvider,
    private readonly imageMatcher: VisualSearchProvider,
    private readonly maxProducts = 3,
  ) {
    this.name = recognizer.name ?? 'gemini';
    this.model = recognizer.model;
    this.configured = recognizer.configured;
  }

  async search(image: Buffer, detailImages?: Buffer[]): Promise<SearchResult> {
    const result = await this.recognizer.search(image, detailImages);
    if (!this.imageMatcher.configured || !result.products?.length) return result;
    const products = await Promise.all(result.products.map(async (product, index) => {
      if (index >= this.maxProducts || !validBox(product.box)) return product;
      try {
        const crop = await cropProduct(image, product.box);
        const visual = await this.imageMatcher.search(crop);
        const imageMatches = visual.matches.filter(match => match.matchKind !== 'search_link');
        if (!imageMatches.length) return product;
        return { ...product, matches: mergeMatches(imageMatches, product.matches) };
      } catch {
        // A failed image lookup must not discard successful product recognition.
        return product;
      }
    }));
    return { ...result, products, matches: products.flatMap(product => product.matches) };
  }
}

function validBox(box?: number[]): box is [number, number, number, number] {
  if (!Array.isArray(box) || box.length !== 4) return false;
  const [left, top, right, bottom] = box;
  return [left, top, right, bottom].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1)
    && right! > left! && bottom! > top!;
}

async function cropProduct(image: Buffer, box: [number, number, number, number]) {
  const { width, height } = await sharp(image).metadata();
  if (!width || !height) throw new Error('Invalid image dimensions');
  const left = Math.min(width - 1, Math.floor(box[0] * width));
  const top = Math.min(height - 1, Math.floor(box[1] * height));
  const right = Math.min(width, Math.ceil(box[2] * width));
  const bottom = Math.min(height, Math.ceil(box[3] * height));
  return sharp(image).extract({ left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) })
    .jpeg({ quality: 90 }).toBuffer();
}

function mergeMatches(visual: ProductMatch[], fallback: ProductMatch[]) {
  const seen = new Set<string>();
  return [...visual, ...fallback].filter(match => {
    if (seen.has(match.url)) return false;
    seen.add(match.url);
    return true;
  });
}
