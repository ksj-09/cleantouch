export type CleanTouchKeyframe = {
  time: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CleanTouchProduct = {
  id: string;
  name: string;
  price: number;
  currency?: string;
  image?: string;
  productUrl: string;
  activeFrom: number;
  activeTo: number;
  keyframes: CleanTouchKeyframe[];
  metadata?: Record<string, string | number | boolean>;
};

export type CleanTouchEventName = 'impression' | 'product_select' | 'add_to_cart' | 'purchase_click' | 'close';

export type CleanTouchEvent = {
  type: CleanTouchEventName;
  contentId: string;
  productId?: string;
  videoTime: number;
  occurredAt: string;
};

export type CleanTouchOptions = {
  video: string | HTMLVideoElement;
  contentId: string;
  products?: CleanTouchProduct[];
  dataUrl?: string;
  analyticsUrl?: string;
  accentColor?: string;
  longPressMs?: number;
  onEvent?: (event: CleanTouchEvent) => void;
  onAddToCart?: (product: CleanTouchProduct) => void | Promise<void>;
  onPurchase?: (product: CleanTouchProduct) => void | Promise<void>;
};

export type CleanTouchRemoteData = {
  contentId?: string;
  products: CleanTouchProduct[];
};

export type CleanTouchController = {
  updateProducts(products: CleanTouchProduct[]): void;
  destroy(): void;
};
