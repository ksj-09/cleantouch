import type { ProductMapping } from './model';
import type { CleanTouchProduct } from './sdk/types';

export const CONTENT_ID = 'morrow-fall-026';
export const STUDIO_KEY = 'ct_demo_studio_key';
export const API_ORIGIN = `${window.location.protocol}//${window.location.hostname}:8787`;
export const CONTENT_URL = `${API_ORIGIN}/v1/content/${CONTENT_ID}`;
export const ANALYTICS_URL = `${API_ORIGIN}/v1/events`;
export const SDK_URL = `${API_ORIGIN}/v1/cleantouch.js`;

function numericPrice(value: string) {
  return Number(value.replace(/[^0-9]/g, '')) || 0;
}

export function mappingToProduct(mapping: ProductMapping): CleanTouchProduct {
  const frame = mapping.hotspot;
  return {
    id: 'bag-014',
    name: mapping.productName.trim() || '이름 없는 상품',
    price: numericPrice(mapping.price),
    currency: 'KRW',
    productUrl: mapping.productUrl,
    activeFrom: mapping.startTime,
    activeTo: mapping.endTime,
    keyframes: [
      { time: mapping.startTime, ...frame },
      { time: mapping.endTime, ...frame }
    ]
  };
}

export async function publishMapping(mapping: ProductMapping) {
  const response = await fetch(CONTENT_URL, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      'x-cleantouch-key': STUDIO_KEY
    },
    body: JSON.stringify({
      title: '가을 데일리룩 01',
      published: mapping.published,
      products: [mappingToProduct(mapping)]
    })
  });
  if (!response.ok) throw new Error(`발행 API 오류 (${response.status})`);
  return response.json();
}

export function localInstallCode() {
  return `<script src="${SDK_URL}"></script>\n<script>\n  CleanTouch.attach({\n    video: "#product-video",\n    contentId: "${CONTENT_ID}",\n    dataUrl: "${CONTENT_URL}",\n    analyticsUrl: "${ANALYTICS_URL}"\n  });\n</script>`;
}
