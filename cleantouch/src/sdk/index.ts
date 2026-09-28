import type {
  CleanTouchController,
  CleanTouchEvent,
  CleanTouchEventName,
  CleanTouchKeyframe,
  CleanTouchOptions,
  CleanTouchProduct,
  CleanTouchRemoteData,
} from './types';

export type {
  CleanTouchController,
  CleanTouchEvent,
  CleanTouchEventName,
  CleanTouchKeyframe,
  CleanTouchOptions,
  CleanTouchProduct,
  CleanTouchRemoteData,
};

const VERSION = '0.3.0';

const styles = `
  :host { all: initial; position: absolute; z-index: 2147483000; display: block; pointer-events: none; font-family: Pretendard, "Noto Sans KR", system-ui, sans-serif; color: #172027; }
  *, *::before, *::after { box-sizing: border-box; }
  button { font: inherit; }
  .ct-root { position: absolute; inset: 0; overflow: hidden; border-radius: inherit; pointer-events: none; }
  .ct-hotspot { position: absolute; border: 0; padding: 0; border-radius: 18px; background: transparent; cursor: pointer; pointer-events: auto; touch-action: none; -webkit-tap-highlight-color: transparent; }
  .ct-hotspot:focus-visible { outline: 3px solid color-mix(in srgb, var(--ct-accent) 55%, white); outline-offset: 3px; }
  .ct-progress { position: absolute; left: 50%; top: 50%; width: 52px; height: 52px; translate: -50% -50%; border: 3px solid color-mix(in srgb, var(--ct-accent) 85%, white); border-radius: 50%; opacity: 0; scale: .55; box-shadow: 0 0 22px var(--ct-accent); }
  .ct-hotspot.is-pressing .ct-progress { opacity: 1; animation: ct-hold var(--ct-hold-time) linear forwards; }
  @keyframes ct-hold { from { scale: .45; box-shadow: 0 0 0 0 color-mix(in srgb, var(--ct-accent) 35%, transparent); } to { scale: 1; box-shadow: 0 0 0 15px transparent; } }
  .ct-hint { position: absolute; left: 50%; bottom: 9%; translate: -50% 0; display: flex; align-items: center; gap: 7px; max-width: 88%; padding: 9px 13px; border: 1px solid rgba(255,255,255,.35); border-radius: 999px; color: white; background: rgba(9,25,32,.7); box-shadow: 0 8px 24px rgba(0,0,0,.2); backdrop-filter: blur(12px); font-size: clamp(9px, 2.7cqw, 12px); font-weight: 700; line-height: 1; white-space: nowrap; animation: ct-hint-in .35s ease both; }
  .ct-hint::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--ct-accent); box-shadow: 0 0 0 4px color-mix(in srgb, var(--ct-accent) 18%, transparent); }
  @keyframes ct-hint-in { from { opacity: 0; translate: -50% 8px; } }
  .ct-dim { position: absolute; inset: 0; background: rgba(3,14,20,.23); animation: ct-fade .2s ease both; }
  .ct-outline { position: absolute; border: 3px solid var(--ct-accent); border-radius: 18px; background: color-mix(in srgb, var(--ct-accent) 7%, transparent); box-shadow: 0 0 0 999px rgba(4,16,23,.12), 0 0 20px var(--ct-accent), inset 0 0 18px color-mix(in srgb, var(--ct-accent) 22%, transparent); pointer-events: none; animation: ct-pulse 1s ease-in-out infinite alternate; }
  @keyframes ct-pulse { from { filter: brightness(.9); } to { filter: brightness(1.25); } }
  @keyframes ct-fade { from { opacity: 0; } }
  .ct-card { position: absolute; left: 0; right: 0; bottom: 0; min-height: 35%; padding: 14px clamp(14px, 4cqw, 24px) clamp(16px, 4cqw, 24px); border-radius: clamp(20px, 6cqw, 30px) clamp(20px, 6cqw, 30px) 0 0; color: #172027; background: rgba(255,255,255,.98); box-shadow: 0 -20px 60px rgba(7,24,32,.24); pointer-events: auto; animation: ct-sheet .38s cubic-bezier(.22,.9,.35,1) both; }
  @keyframes ct-sheet { from { translate: 0 110%; } }
  .ct-handle { display: block; width: 38px; height: 5px; margin: 0 auto 12px; border: 0; border-radius: 9px; background: #d7dde0; cursor: pointer; }
  .ct-product { display: grid; grid-template-columns: clamp(56px, 19cqw, 82px) 1fr 28px; align-items: center; gap: clamp(10px, 3cqw, 15px); }
  .ct-image { aspect-ratio: 1; display: grid; place-items: center; overflow: hidden; border-radius: 15px; background: #f0f3f4; }
  .ct-image img { width: 100%; height: 100%; object-fit: cover; }
  .ct-placeholder { width: 58%; height: 44%; border-radius: 8px 8px 14px 14px; background: linear-gradient(135deg,#36383c,#080a0c); box-shadow: 0 7px 13px rgba(0,0,0,.2); }
  .ct-copy { min-width: 0; display: grid; gap: 3px; }
  .ct-eyebrow { color: color-mix(in srgb, var(--ct-accent) 80%, #04516a); font-size: clamp(7px, 1.7cqw, 9px); font-weight: 800; letter-spacing: 1px; }
  .ct-name { overflow: hidden; color: #172027; font-size: clamp(13px, 4cqw, 18px); font-weight: 800; line-height: 1.3; text-overflow: ellipsis; white-space: nowrap; }
  .ct-price { color: #172027; font-size: clamp(14px, 4.2cqw, 19px); font-weight: 800; }
  .ct-close { align-self: start; width: 28px; height: 28px; border: 0; border-radius: 50%; color: #68747b; background: #f0f3f4; cursor: pointer; }
  .ct-close::before, .ct-close::after { content: ''; position: absolute; width: 12px; height: 1.5px; margin: -1px 0 0 -6px; background: currentColor; rotate: 45deg; }
  .ct-close::after { rotate: -45deg; }
  .ct-meta { display: flex; align-items: center; gap: 7px; min-height: 36px; margin-top: 7px; border-top: 1px solid #edf0f1; color: #708089; font-size: clamp(8px, 2.2cqw, 10px); }
  .ct-meta b { color: #25a678; margin-left: auto; }
  .ct-actions { display: grid; grid-template-columns: 1fr 1.35fr; gap: 9px; }
  .ct-actions button { min-height: clamp(40px, 12cqw, 50px); border-radius: 13px; font-size: clamp(10px, 3cqw, 13px); font-weight: 800; cursor: pointer; }
  .ct-cart { color: color-mix(in srgb, var(--ct-accent) 75%, #07546b); border: 1px solid var(--ct-accent); background: white; }
  .ct-buy { color: white; border: 0; background: var(--ct-accent); box-shadow: 0 10px 22px color-mix(in srgb, var(--ct-accent) 25%, transparent); }
  .ct-toast { position: absolute; left: 50%; bottom: 39%; translate: -50% 0; max-width: 90%; padding: 10px 14px; border-radius: 12px; color: white; background: rgba(11,31,40,.93); box-shadow: 0 10px 30px rgba(0,0,0,.25); font-size: clamp(9px, 2.5cqw, 11px); font-weight: 700; white-space: nowrap; animation: ct-fade .2s ease both; }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; } }
`;

function resolveVideo(target: string | HTMLVideoElement) {
  const video = typeof target === 'string' ? document.querySelector(target) : target;
  if (!(video instanceof HTMLVideoElement)) {
    throw new Error('[CleanTouch] video target was not found or is not an HTMLVideoElement.');
  }
  return video;
}

function normalizeKeyframes(product: CleanTouchProduct) {
  return [...product.keyframes].sort((a, b) => a.time - b.time);
}

function interpolate(product: CleanTouchProduct, time: number): CleanTouchKeyframe {
  const frames = normalizeKeyframes(product);
  if (!frames.length) return { time, x: 0, y: 0, width: 0, height: 0 };
  if (time <= frames[0].time) return frames[0];
  if (time >= frames[frames.length - 1].time) return frames[frames.length - 1];
  const nextIndex = frames.findIndex((frame) => frame.time >= time);
  const previous = frames[nextIndex - 1];
  const next = frames[nextIndex];
  const ratio = (time - previous.time) / Math.max(.001, next.time - previous.time);
  const blend = (from: number, to: number) => from + (to - from) * ratio;
  return {
    time,
    x: blend(previous.x, next.x),
    y: blend(previous.y, next.y),
    width: blend(previous.width, next.width),
    height: blend(previous.height, next.height),
  };
}

class CleanTouchRuntime implements CleanTouchController {
  private readonly video: HTMLVideoElement;
  private readonly options: CleanTouchOptions;
  private readonly host: HTMLDivElement;
  private readonly shadow: ShadowRoot;
  private readonly root: HTMLDivElement;
  private readonly parent: HTMLElement;
  private readonly previousParentPosition: string;
  private products: CleanTouchProduct[];
  private hotspots = new Map<string, HTMLButtonElement>();
  private selected: CleanTouchProduct | null = null;
  private pressTimer: number | null = null;
  private toastTimer: number | null = null;
  private animationFrame = 0;
  private resizeObserver: ResizeObserver;
  private hint: HTMLDivElement;

  constructor(video: HTMLVideoElement, options: CleanTouchOptions, products: CleanTouchProduct[]) {
    this.video = video;
    this.options = options;
    this.products = products;
    const parent = video.parentElement;
    if (!parent) throw new Error('[CleanTouch] video must be connected to a parent element.');
    this.parent = parent;
    this.previousParentPosition = parent.style.position;
    if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';

    this.host = document.createElement('div');
    this.host.dataset.cleantouchRoot = options.contentId;
    this.shadow = this.host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = styles;
    this.root = document.createElement('div');
    this.root.className = 'ct-root';
    this.root.style.setProperty('--ct-accent', options.accentColor ?? '#13b8e6');
    this.root.style.setProperty('--ct-hold-time', `${options.longPressMs ?? 600}ms`);
    this.hint = document.createElement('div');
    this.hint.className = 'ct-hint';
    this.hint.textContent = '궁금한 제품을 길게 눌러보세요';
    this.root.append(this.hint);
    this.shadow.append(style, this.root);
    parent.append(this.host);

    this.resizeObserver = new ResizeObserver(() => this.syncBounds());
    this.resizeObserver.observe(video);
    this.syncBounds();
    this.renderHotspots();
    this.tick();
    this.emit('impression');
  }

  updateProducts(products: CleanTouchProduct[]) {
    this.products = products;
    this.renderHotspots();
  }

  destroy() {
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    if (this.pressTimer !== null) window.clearTimeout(this.pressTimer);
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.resizeObserver.disconnect();
    this.host.remove();
    this.parent.style.position = this.previousParentPosition;
    this.hotspots.clear();
  }

  private syncBounds() {
    this.host.style.left = `${this.video.offsetLeft}px`;
    this.host.style.top = `${this.video.offsetTop}px`;
    this.host.style.width = `${this.video.offsetWidth}px`;
    this.host.style.height = `${this.video.offsetHeight}px`;
    this.host.style.containerType = 'inline-size';
  }

  private renderHotspots() {
    const knownIds = new Set(this.products.map((product) => product.id));
    for (const [id, button] of this.hotspots) {
      if (!knownIds.has(id)) {
        button.remove();
        this.hotspots.delete(id);
      }
    }
    for (const product of this.products) {
      let button = this.hotspots.get(product.id);
      if (!button) {
        button = document.createElement('button');
        button.className = 'ct-hotspot';
        button.type = 'button';
        const progress = document.createElement('span');
        progress.className = 'ct-progress';
        button.append(progress);
        button.addEventListener('pointerdown', (event) => this.beginPress(event, product));
        button.addEventListener('pointerup', () => this.cancelPress(button));
        button.addEventListener('pointercancel', () => this.cancelPress(button));
        button.addEventListener('pointerleave', () => this.cancelPress(button));
        button.addEventListener('contextmenu', (event) => event.preventDefault());
        button.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.selectProduct(product);
          }
        });
        this.hotspots.set(product.id, button);
        this.root.append(button);
      }
      button.setAttribute('aria-label', `${product.name} 길게 눌러 상품 정보 보기`);
    }
  }

  private beginPress(event: PointerEvent, product: CleanTouchProduct) {
    if (this.selected) return;
    const button = event.currentTarget as HTMLButtonElement;
    button.setPointerCapture(event.pointerId);
    button.classList.add('is-pressing');
    this.pressTimer = window.setTimeout(() => this.selectProduct(product), this.options.longPressMs ?? 600);
  }

  private cancelPress(button?: HTMLButtonElement) {
    if (this.pressTimer !== null) window.clearTimeout(this.pressTimer);
    this.pressTimer = null;
    button?.classList.remove('is-pressing');
  }

  private selectProduct(product: CleanTouchProduct) {
    this.cancelPress(this.hotspots.get(product.id));
    this.selected = product;
    this.video.pause();
    this.hint.hidden = true;
    this.emit('product_select', product);
    this.renderSelection(product);
  }

  private renderSelection(product: CleanTouchProduct) {
    this.root.querySelectorAll('.ct-dim, .ct-outline, .ct-card, .ct-toast').forEach((element) => element.remove());
    const frame = interpolate(product, this.video.currentTime);
    const dim = document.createElement('div');
    dim.className = 'ct-dim';
    const outline = document.createElement('div');
    outline.className = 'ct-outline';
    Object.assign(outline.style, {
      left: `${frame.x}%`, top: `${frame.y}%`, width: `${frame.width}%`, height: `${frame.height}%`,
    });
    const card = document.createElement('section');
    card.className = 'ct-card';
    card.setAttribute('aria-label', '선택한 상품 정보');
    card.innerHTML = `
      <button class="ct-handle" type="button" aria-label="상품 정보 닫기"></button>
      <div class="ct-product">
        <div class="ct-image">${product.image ? `<img src="${this.escapeAttribute(product.image)}" alt="" />` : '<span class="ct-placeholder"></span>'}</div>
        <div class="ct-copy"><span class="ct-eyebrow">CLEANTOUCH SELECT</span><strong class="ct-name"></strong><b class="ct-price"></b></div>
        <button class="ct-close" type="button" aria-label="닫기"></button>
      </div>
      <div class="ct-meta"><span>상품 정보 바로보기</span><b>고객사 상품 DB 연동</b></div>
      <div class="ct-actions"><button class="ct-cart" type="button">장바구니</button><button class="ct-buy" type="button">구매하기</button></div>
    `;
    const name = card.querySelector('.ct-name');
    const price = card.querySelector('.ct-price');
    if (name) name.textContent = product.name;
    if (price) price.textContent = new Intl.NumberFormat('ko-KR', { style: 'currency', currency: product.currency ?? 'KRW', maximumFractionDigits: 0 }).format(product.price);
    const close = () => this.closeSelection();
    card.querySelector('.ct-handle')?.addEventListener('click', close);
    card.querySelector('.ct-close')?.addEventListener('click', close);
    card.querySelector('.ct-cart')?.addEventListener('click', () => void this.addToCart(product));
    card.querySelector('.ct-buy')?.addEventListener('click', () => void this.purchase(product));
    this.root.append(dim, outline, card);
  }

  private closeSelection() {
    if (!this.selected) return;
    this.emit('close', this.selected);
    this.selected = null;
    this.root.querySelectorAll('.ct-dim, .ct-outline, .ct-card, .ct-toast').forEach((element) => element.remove());
    void this.video.play().catch(() => undefined);
  }

  private async addToCart(product: CleanTouchProduct) {
    await this.options.onAddToCart?.(product);
    this.emit('add_to_cart', product);
    this.showToast('장바구니에 상품을 담았습니다.');
  }

  private async purchase(product: CleanTouchProduct) {
    this.emit('purchase_click', product);
    if (this.options.onPurchase) {
      await this.options.onPurchase(product);
    } else {
      window.location.assign(product.productUrl);
    }
  }

  private showToast(message: string) {
    this.root.querySelector('.ct-toast')?.remove();
    const toast = document.createElement('div');
    toast.className = 'ct-toast';
    toast.textContent = message;
    this.root.append(toast);
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => toast.remove(), 2200);
  }

  private emit(type: CleanTouchEventName, product?: CleanTouchProduct) {
    const payload: CleanTouchEvent = {
      type,
      contentId: this.options.contentId,
      productId: product?.id,
      videoTime: this.video.currentTime,
      occurredAt: new Date().toISOString(),
    };
    this.options.onEvent?.(payload);
    this.video.dispatchEvent(new CustomEvent(`cleantouch:${type}`, { detail: payload, bubbles: true }));
    if (this.options.analyticsUrl) {
      void fetch(this.options.analyticsUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
        credentials: 'omit',
      }).catch(() => undefined);
    }
  }

  private tick = () => {
    if (!this.selected) {
      const time = this.video.currentTime;
      let visibleCount = 0;
      for (const product of this.products) {
        const button = this.hotspots.get(product.id);
        if (!button) continue;
        const visible = time >= product.activeFrom && time <= product.activeTo && product.keyframes.length > 0;
        button.hidden = !visible;
        if (!visible) continue;
        visibleCount += 1;
        const frame = interpolate(product, time);
        Object.assign(button.style, {
          left: `${frame.x}%`, top: `${frame.y}%`, width: `${frame.width}%`, height: `${frame.height}%`,
        });
      }
      this.hint.hidden = visibleCount === 0;
    }
    this.animationFrame = requestAnimationFrame(this.tick);
  };

  private escapeAttribute(value: string) {
    return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  }
}

export async function attach(options: CleanTouchOptions): Promise<CleanTouchController> {
  const video = resolveVideo(options.video);
  let products = options.products ?? [];
  if (options.dataUrl) {
    const response = await fetch(options.dataUrl, { credentials: 'omit' });
    if (!response.ok) throw new Error(`[CleanTouch] product data request failed with ${response.status}.`);
    const data = await response.json() as CleanTouchRemoteData;
    products = data.products;
  }
  return new CleanTouchRuntime(video, options, products);
}

export const CleanTouch = { attach, version: VERSION };

declare global {
  interface Window {
    CleanTouch?: typeof CleanTouch;
  }
}

if (typeof window !== 'undefined') window.CleanTouch = CleanTouch;
