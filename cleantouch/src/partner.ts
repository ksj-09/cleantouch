import type { CleanTouchEvent } from './sdk/types';
import { ANALYTICS_URL, CONTENT_ID, CONTENT_URL } from './content-api';
import './partner.css';

function required<ElementType extends Element>(selector: string) {
  const element = document.querySelector<ElementType>(selector);
  if (!element) throw new Error(`Partner demo element is missing: ${selector}`);
  return element;
}

const video = required<HTMLVideoElement>('#product-video');
const toggle = required<HTMLButtonElement>('#video-toggle');
const progress = required<HTMLSpanElement>('#video-progress-value');
const cartCount = required<HTMLElement>('#cart-count');
const toast = required<HTMLElement>('#partner-toast');
const eventList = required<HTMLOListElement>('#event-list');

let cart = 0;
let toastTimer = 0;

function showPartnerToast(message: string) {
  toast.textContent = message;
  toast.classList.add('visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 2400);
}

function logEvent(event: CleanTouchEvent) {
  const entry = document.createElement('li');
  const time = new Date(event.occurredAt).toLocaleTimeString('ko-KR', { hour12: false });
  entry.innerHTML = `<time>${time}</time><b>${event.type}</b><span>${event.productId ?? event.contentId}</span>`;
  const placeholder = eventList.querySelector('li');
  if (placeholder?.textContent?.includes('연결 대기 중')) placeholder.remove();
  eventList.prepend(entry);
  while (eventList.children.length > 4) eventList.lastElementChild?.remove();
}

if (!window.CleanTouch) throw new Error('CleanTouch SDK script was not loaded.');

const controller = await window.CleanTouch.attach({
  video,
  contentId: CONTENT_ID,
  dataUrl: CONTENT_URL,
  analyticsUrl: ANALYTICS_URL,
  accentColor: '#25c6e8',
  onEvent: logEvent,
  onAddToCart: async () => {
    cart += 1;
    cartCount.textContent = String(cart);
    showPartnerToast('MORROW 장바구니에 상품을 담았습니다.');
  },
  onPurchase: async (selectedProduct) => {
    showPartnerToast(`${selectedProduct.name} 상품 페이지로 연결합니다.`);
  },
});

Object.assign(window, { __cleanTouchController: controller });

toggle.addEventListener('click', () => {
  if (video.paused) {
    void video.play();
  } else {
    video.pause();
  }
});

video.addEventListener('play', () => {
  toggle.textContent = 'Ⅱ';
  toggle.setAttribute('aria-label', '영상 일시정지');
});

video.addEventListener('pause', () => {
  toggle.textContent = '▶';
  toggle.setAttribute('aria-label', '영상 재생');
});

video.addEventListener('timeupdate', () => {
  const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 6.2;
  progress.style.width = `${Math.min(100, (video.currentTime / duration) * 100)}%`;
});
