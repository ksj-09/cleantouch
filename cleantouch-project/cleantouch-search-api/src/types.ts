export type ProductMatch = {
  id: string;
  title: string;
  source: string;
  url: string;
  imageUrl?: string;
  price?: string;
  matchKind: 'exact_image' | 'partial_image' | 'search_link';
};

export type SearchResult = {
  queryLabel: string;
  matches: ProductMatch[];
  products?: Array<{ id: string; label: string; matches: ProductMatch[]; box?: number[] }>;
};

export interface VisualSearchProvider {
  readonly name?: string;
  readonly model?: string;
  readonly configured: boolean;
  readonly visualMatchesConfigured?: boolean;
  search(image: Buffer, detailImages?: Buffer[]): Promise<SearchResult>;
}
