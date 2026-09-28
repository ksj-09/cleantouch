import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react';
import {
  defaultMapping,
  loadMapping,
  loadStoredVideo,
  removeStoredVideo,
  saveMapping,
  storeVideo,
  type Hotspot,
  type ProductMapping,
} from './model';
import { CONTENT_ID, CONTENT_URL, publishMapping, localInstallCode } from './content-api';

type View = 'experience' | 'studio';
type StudioTab = 'mapping' | 'analytics' | 'install';

const formatTime = (seconds: number) => `00:${String(Math.floor(seconds)).padStart(2, '0')}`;

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

function Icon({ name }: { name: 'play' | 'pause' | 'heart' | 'chat' | 'share' | 'bag' | 'spark' | 'close' | 'check' }) {
  const paths = {
    play: <path d="M8 5v14l11-7z" />,
    pause: <><path d="M7 5h4v14H7z" /><path d="M14 5h4v14h-4z" /></>,
    heart: <path d="M12 20.5S4 16 4 9.5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 8 3.5c0 6.5-8 11-8 11Z" />,
    chat: <path d="M20 11.5a7.5 7.5 0 1 1-3-6l3 1.5v4.5Z" />,
    share: <><circle cx="18" cy="5" r="2.2" /><circle cx="6" cy="12" r="2.2" /><circle cx="18" cy="19" r="2.2" /><path d="m8 11 8-5M8 13l8 5" /></>,
    bag: <><path d="M6 8h12l1 12H5L6 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></>,
    spark: <><path d="m12 2 1.4 5.6L19 9l-5.6 1.4L12 16l-1.4-5.6L5 9l5.6-1.4L12 2Z" /><path d="m18.5 14 .7 2.8 2.8.7-2.8.7-.7 2.8-.7-2.8-2.8-.7 2.8-.7.7-2.8Z" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    check: <path d="m5 12 4 4L19 6" />,
  };
  return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function FashionScene({ selected = false, editor = false }: { selected?: boolean; editor?: boolean }) {
  return (
    <svg className="fashion-scene" viewBox="0 0 390 690" role="img" aria-label="크림색 재킷과 검은 숄더백을 착용한 모델">
      <defs>
        <linearGradient id="wall" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d8d3ca" />
          <stop offset=".48" stopColor="#a9a59f" />
          <stop offset="1" stopColor="#777978" />
        </linearGradient>
        <linearGradient id="jacket" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fffdf5" />
          <stop offset="1" stopColor="#d8d2c5" />
        </linearGradient>
        <linearGradient id="bag" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#343438" />
          <stop offset=".7" stopColor="#111216" />
          <stop offset="1" stopColor="#050506" />
        </linearGradient>
        <filter id="bagGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feFlood floodColor="#20c8ff" floodOpacity=".9" />
          <feComposite in2="blur" operator="in" />
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="9" stdDeviation="12" floodOpacity=".28" />
        </filter>
      </defs>

      <rect width="390" height="690" fill="url(#wall)" />
      <rect x="0" y="0" width="126" height="690" fill="#dcd7cd" opacity=".48" />
      <rect x="132" y="0" width="7" height="690" fill="#555a59" opacity=".24" />
      <rect x="285" y="0" width="105" height="690" fill="#252a2c" opacity=".32" />
      <path d="M0 554 390 510v180H0Z" fill="#9d9b96" opacity=".45" />

      <g className="scene-model" filter="url(#softShadow)">
        <path d="M176 112c8-60 84-74 115-25 21 34 5 94-36 106-48 14-88-32-79-81Z" fill="#ead1bf" />
        <path d="M163 126c-2-82 94-110 135-46 18 28 8 65-4 78-4-37-18-78-52-83-33-6-54 20-62 53-7 30 2 60 16 81-30-13-34-51-33-83Z" fill="#282524" />
        <path d="M191 81c26-27 83-15 100 25-31-24-61-24-100-25Z" fill="#161516" />
        <path d="M254 131c9-6 22-1 23 9 0 10-12 18-22 13" fill="#e2bda9" />
        <path d="M214 129c8 4 19 4 27-1" fill="none" stroke="#6e4b40" strokeWidth="2" strokeLinecap="round" />
        <path d="M218 149c10 5 18 4 26-1" fill="none" stroke="#af6f68" strokeWidth="3" strokeLinecap="round" />
        <path d="M213 111c4-4 11-5 16-1M250 107c6-2 12 0 15 4" fill="none" stroke="#3e3330" strokeWidth="3" strokeLinecap="round" />
        <path d="M178 191c-42 24-61 93-58 172l8 179 179 4-4-211c-2-82-12-128-59-145Z" fill="url(#jacket)" />
        <path d="M178 203c25 25 45 33 68 2" fill="none" stroke="#c4beb1" strokeWidth="4" />
        <path d="M178 221c-34 22-45 76-46 131M255 208c27 36 27 97 35 151" fill="none" stroke="#c8c1b4" strokeWidth="3" />
        <path d="M121 304c-27 79-30 137-4 166 19 20 50 4 58-22l-9-105Z" fill="url(#jacket)" />
        <path d="M121 468c20 18 45 0 53-24l5 39c-15 28-51 35-64 9Z" fill="#ead1bf" />
        <path d="M143 538h159l8 152H118Z" fill="#eeeae1" />
        <path d="M220 540v150M163 546l-8 144" stroke="#cbc6bd" strokeWidth="3" />

        <path d="M214 193c28 34 57 90 73 155" fill="none" stroke="#17181b" strokeWidth="14" strokeLinecap="round" className={selected ? 'bag-glow-line' : ''} />
        <g id="product-bag" className={selected ? 'selected-bag' : ''}>
          <path d="M218 323c28-14 77-17 105 2l23 137c-34 28-112 27-144-5Z" fill="url(#bag)" stroke="#050506" strokeWidth="5" />
          <path d="M208 364c37 18 93 18 126-5" fill="none" stroke="#4c4c51" strokeWidth="3" opacity=".55" />
          <path d="M221 329c16-23 78-26 99-1" fill="none" stroke="#45454a" strokeWidth="4" />
          <circle cx="273" cy="399" r="6" fill="#a99e81" />
        </g>
      </g>

      {selected && <rect width="390" height="690" fill="#071018" opacity=".2" className="selection-dim" />}
      {selected && (
        <g className="selected-outline">
          <path d="M214 193c28 34 57 90 73 155" fill="none" stroke="#4fddff" strokeWidth="4" strokeLinecap="round" />
          <path d="M218 323c28-14 77-17 105 2l23 137c-34 28-112 27-144-5Z" fill="none" stroke="#4fddff" strokeWidth="5" filter="url(#bagGlow)" />
        </g>
      )}
      {editor && (
        <g className="editor-box">
          <rect x="190" y="176" width="165" height="306" rx="8" fill="none" stroke="#4fddff" strokeWidth="3" strokeDasharray="8 6" />
          <rect x="190" y="145" width="106" height="28" rx="7" fill="#10a8d5" />
          <text x="202" y="164" fill="white" fontSize="14" fontWeight="700">미니멀 숄더백</text>
          <circle cx="190" cy="176" r="6" fill="white" stroke="#10a8d5" strokeWidth="3" />
          <circle cx="355" cy="482" r="6" fill="white" stroke="#10a8d5" strokeWidth="3" />
        </g>
      )}
    </svg>
  );
}

function ProductSheet({ product, onClose, onCart, onBuy }: { product: ProductMapping; onClose: () => void; onCart: () => void; onBuy: () => void }) {
  return (
    <section className="product-sheet" aria-label="선택한 상품 정보">
      <button className="sheet-handle" onClick={onClose} aria-label="상품 정보 닫기" />
      <div className="product-summary">
        <div className="bag-thumbnail" aria-hidden="true"><span /></div>
        <div className="product-copy">
          <span className="eyebrow">CLEANTOUCH SELECT</span>
          <strong>{product.productName}</strong>
          <div className="rating"><span>★★★★★</span> <small>4.8 · 리뷰 342</small></div>
          <b>{product.price}원</b>
        </div>
        <button className="sheet-close" onClick={onClose} aria-label="닫기"><Icon name="close" /></button>
      </div>
      <div className="option-row">
        <span>색상</span>
        <button className="color-dot black active" aria-label="블랙 선택됨" />
        <button className="color-dot ivory" aria-label="아이보리" />
        <em>무료배송 · 오늘 출발</em>
      </div>
      <div className="sheet-actions">
        <button className="secondary-button" onClick={onCart}><Icon name="bag" /> 장바구니</button>
        <button className="primary-button" onClick={onBuy}>구매하기</button>
      </div>
    </section>
  );
}

function ViewerDemo({ mapping, videoUrl, videoName }: { mapping: ProductMapping; videoUrl: string | null; videoName: string | null }) {
  const [selected, setSelected] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [pressing, setPressing] = useState(false);
  const [time, setTime] = useState(8);
  const [cartCount, setCartCount] = useState(0);
  const [toast, setToast] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const pressTimer = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const duration = videoUrl ? Math.max(mapping.duration, 1) : 15;
  const isProductVisible = !videoUrl || (time >= mapping.startTime && time <= mapping.endTime);

  useEffect(() => {
    if (videoUrl) return;
    if (!playing || selected) return;
    const timer = window.setInterval(() => {
      setTime((current) => current >= 15 ? 0 : Math.min(15, current + 0.2));
    }, 200);
    return () => window.clearInterval(timer);
  }, [playing, selected, videoUrl]);

  useEffect(() => {
    setSelected(false);
    if (videoUrl) setTime(0);
  }, [videoUrl]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const cancelPress = () => {
    if (pressTimer.current !== null) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
    setPressing(false);
  };

  const selectProduct = () => {
    if (!isProductVisible || !mapping.published) return;
    cancelPress();
    setSelected(true);
    setPlaying(false);
    videoRef.current?.pause();
  };

  const beginPress = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setPressing(true);
    pressTimer.current = window.setTimeout(selectProduct, 620);
  };

  const reset = () => {
    cancelPress();
    setSelected(false);
    setPlaying(true);
    setShowCheckout(false);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      void videoRef.current.play();
    }
  };

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) {
      setPlaying((value) => !value);
      return;
    }
    if (video.paused) {
      void video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  };

  const closeProduct = () => {
    setSelected(false);
    setPlaying(true);
    if (videoRef.current) void videoRef.current.play();
  };

  return (
    <main className="experience-layout">
      <section className="intro-panel">
        <span className="section-kicker">INTERACTIVE COMMERCE VIDEO</span>
        <h1>고객사 영상은 그대로.<br /><span>터치 경험만 추가.</span></h1>
        <p>이 화면은 고객사 영상 위에 올라가는 SDK 오버레이를 확대해 확인하는 개발 미리보기입니다. 실제 사용자는 기존 쇼핑몰을 벗어나지 않습니다.</p>
        <div className="demo-instruction">
          <span className="instruction-number">01</span>
          <div><strong>{mapping.productName}을 길게 누르세요</strong><small>약 0.6초 동안 누르면 제품이 선택됩니다.</small></div>
        </div>
        <div className="benefit-row">
          <div><b>0</b><span>고정 상품 태그</span></div>
          <div><b>1 touch</b><span>정보 확인</span></div>
          <div><b>실시간</b><span>관심 데이터</span></div>
        </div>
        <button className="text-button" onClick={reset}>데모 다시 시작 <span>↻</span></button>
        <a className="partner-demo-link" href="/partner.html">고객사 샘플몰에서 확인 <span>↗</span></a>
        <div className={`media-source-pill ${videoUrl ? 'custom' : ''}`}><span /> {videoUrl ? `업로드 영상 · ${videoName}` : '기본 데모 장면'}</div>
      </section>

      <section className="phone-stage" aria-label="클린터치 사용자 경험 데모">
        <div className="stage-glow" />
        <div className="phone-shell">
          <div className="phone-speaker" />
          <div className="phone-screen">
            <div className={`video-layer ${selected ? 'is-selected' : ''} ${playing ? 'is-playing' : ''}`}>
              {videoUrl ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  muted
                  loop
                  playsInline
                  autoPlay
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
                />
              ) : <FashionScene selected={selected} />}
              {videoUrl && selected && (
                <span
                  className="custom-selection-outline"
                  style={{ left: `${mapping.hotspot.x}%`, top: `${mapping.hotspot.y}%`, width: `${mapping.hotspot.width}%`, height: `${mapping.hotspot.height}%` }}
                />
              )}
            </div>

            <header className="video-header">
              <div className="mini-brand"><BrandMark /> CleanTouch</div>
              <button aria-label="더보기">•••</button>
            </header>

            <aside className="social-actions" aria-label="영상 반응">
              <button><Icon name="heart" /><span>1.2만</span></button>
              <button><Icon name="chat" /><span>342</span></button>
              <button><Icon name="share" /><span>공유</span></button>
            </aside>

            {!selected && isProductVisible && mapping.published && (
              <div className="touch-hint"><Icon name="spark" /> 제품을 길게 눌러보세요</div>
            )}

            {isProductVisible && mapping.published && <button
              className={`product-hotspot ${pressing ? 'is-pressing' : ''}`}
              aria-label={`${mapping.productName} 길게 눌러 상품 정보 보기`}
              style={{ left: `${mapping.hotspot.x}%`, top: `${mapping.hotspot.y}%`, width: `${mapping.hotspot.width}%`, height: `${mapping.hotspot.height}%` }}
              onPointerDown={beginPress}
              onPointerUp={cancelPress}
              onPointerCancel={cancelPress}
              onPointerLeave={cancelPress}
              onContextMenu={(event) => event.preventDefault()}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  selectProduct();
                }
              }}
            >
              <span className="press-ring" />
            </button>}

            {!selected && (
              <footer className="video-controls">
                <button onClick={togglePlayback} aria-label={playing ? '일시정지' : '재생'}>
                  <Icon name={playing ? 'pause' : 'play'} />
                </button>
                <div className="progress-track"><span style={{ width: `${Math.min(100, (time / duration) * 100)}%` }} /></div>
                <time>{formatTime(time)} / {formatTime(duration)}</time>
              </footer>
            )}

            {selected && (
              <ProductSheet
                product={mapping}
                onClose={closeProduct}
                onCart={() => { setCartCount((count) => count + 1); setToast('장바구니에 상품을 담았습니다.'); }}
                onBuy={() => setShowCheckout(true)}
              />
            )}

            {toast && <div className="toast"><Icon name="check" /> {toast}</div>}
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </div>
        </div>
        <div className="stage-caption"><span className={selected ? 'done' : 'active'}>1</span><i /><span className={selected ? 'active' : ''}>2</span><small>{selected ? '상품 정보 확인 및 구매' : '제품을 길게 터치'}</small></div>
      </section>

      {showCheckout && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowCheckout(false)}>
          <section className="checkout-modal" role="dialog" aria-modal="true" aria-labelledby="checkout-title" onMouseDown={(event) => event.stopPropagation()}>
            <span className="modal-icon"><Icon name="check" /></span>
            <span className="section-kicker">PROTOTYPE FLOW</span>
            <h2 id="checkout-title">구매 화면으로 연결됩니다</h2>
            <p>실제 도입 시 고객사의 기존 상품 상세 또는 결제 화면을 그대로 호출합니다.</p>
            <small className="checkout-url">{mapping.productUrl}</small>
            <button className="primary-button" onClick={() => setShowCheckout(false)}>데모 계속 보기</button>
          </section>
        </div>
      )}
    </main>
  );
}

const bars = [34, 47, 39, 58, 72, 66, 88, 81, 100, 92];

function MetricCard({ label, value, delta, accent = false }: { label: string; value: string; delta: string; accent?: boolean }) {
  return (
    <article className={`metric-card ${accent ? 'accent' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>↗ {delta} <em>기존 방식 대비</em></small>
    </article>
  );
}

function Studio({
  mapping,
  videoUrl,
  videoName,
  onSave,
  onVideoUpload,
  onVideoRemove,
}: {
  mapping: ProductMapping;
  videoUrl: string | null;
  videoName: string | null;
  onSave: (mapping: ProductMapping) => Promise<void>;
  onVideoUpload: (file: File) => Promise<void>;
  onVideoRemove: () => Promise<void>;
}) {
  const [tab, setTab] = useState<StudioTab>('mapping');
  const [draft, setDraft] = useState(mapping);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [copied, setCopied] = useState(false);
  const [uploadState, setUploadState] = useState('');
  const [editorTime, setEditorTime] = useState(8);
  const [editorPlaying, setEditorPlaying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editorFrameRef = useRef<HTMLDivElement | null>(null);
  const editorVideoRef = useRef<HTMLVideoElement | null>(null);
  const dragState = useRef<{ mode: 'move' | 'resize'; startX: number; startY: number; hotspot: Hotspot } | null>(null);

  useEffect(() => setDraft(mapping), [mapping]);

  const saveDraft = async () => {
    setSaveState('saving');
    try {
      await onSave(draft);
      setSaveState('saved');
      window.setTimeout(() => setSaveState('idle'), 1800);
    } catch {
      setSaveState('error');
    }
  };

  const updateDraft = <Key extends keyof ProductMapping>(key: Key, value: ProductMapping[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handleVideoFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setUploadState('동영상 파일만 업로드할 수 있습니다.');
      return;
    }
    if (file.size > 200 * 1024 * 1024) {
      setUploadState('시제품에서는 200MB 이하 영상을 사용해 주세요.');
      return;
    }
    setUploadState('영상을 저장하는 중입니다…');
    try {
      await onVideoUpload(file);
      setEditorTime(0);
      setUploadState(`${file.name} 저장 완료`);
    } catch {
      setUploadState('영상을 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.');
    }
  };

  const toggleEditorPlayback = () => {
    const video = editorVideoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  };

  const beginHotspotDrag = (mode: 'move' | 'resize', event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = { mode, startX: event.clientX, startY: event.clientY, hotspot: draft.hotspot };
  };

  const moveHotspot = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragState.current;
    const frame = editorFrameRef.current;
    if (!drag || !frame) return;
    const bounds = frame.getBoundingClientRect();
    const deltaX = ((event.clientX - drag.startX) / bounds.width) * 100;
    const deltaY = ((event.clientY - drag.startY) / bounds.height) * 100;
    let hotspot: Hotspot;
    if (drag.mode === 'move') {
      hotspot = {
        ...drag.hotspot,
        x: Math.max(0, Math.min(100 - drag.hotspot.width, drag.hotspot.x + deltaX)),
        y: Math.max(0, Math.min(100 - drag.hotspot.height, drag.hotspot.y + deltaY)),
      };
    } else {
      hotspot = {
        ...drag.hotspot,
        width: Math.max(8, Math.min(100 - drag.hotspot.x, drag.hotspot.width + deltaX)),
        height: Math.max(8, Math.min(100 - drag.hotspot.y, drag.hotspot.height + deltaY)),
      };
    }
    updateDraft('hotspot', hotspot);
  };

  const finishHotspotDrag = () => {
    dragState.current = null;
  };

  const togglePublished = async () => {
    const next = { ...draft, published: !draft.published };
    setDraft(next);
    setSaveState('saving');
    try {
      await onSave(next);
      setSaveState('saved');
      window.setTimeout(() => setSaveState('idle'), 1800);
    } catch {
      setSaveState('error');
    }
  };

  const handleRemoveVideo = async () => {
    await onVideoRemove();
    setUploadState('기본 데모 장면으로 돌아왔습니다.');
    setEditorTime(8);
  };

  const installCode = localInstallCode();

  const copyInstallCode = async () => {
    await navigator.clipboard.writeText(installCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <main className="studio-layout">
      <aside className="studio-sidebar">
        <div className="workspace-label"><span>WS</span><div><b>W Concept Lab</b><small>Starter workspace</small></div></div>
        <nav aria-label="판매자 스튜디오 메뉴">
          <button className="active"><span>◫</span> 콘텐츠</button>
          <button><span>◇</span> 상품</button>
          <button><span>⌁</span> 분석</button>
          <button><span>⚙</span> 설정</button>
        </nav>
        <div className="sidebar-bottom"><span className="status-dot" /> 모든 시스템 정상</div>
      </aside>

      <section className="studio-main">
        <header className="studio-header">
          <div><span className="breadcrumb">콘텐츠 / 가을 데일리룩 01</span><h1>가을 데일리룩 01</h1></div>
          <div className="header-actions">
            <span className={`publish-status ${draft.published ? '' : 'draft'}`}>{draft.published ? '게시 중' : '임시 저장'}</span>
            <button className="outline-button" onClick={togglePublished}>{draft.published ? '게시 중지' : '게시하기'}</button>
          </div>
        </header>

        <div className="studio-tabs" role="tablist">
          <button className={tab === 'mapping' ? 'active' : ''} onClick={() => setTab('mapping')}>상품 연결</button>
          <button className={tab === 'analytics' ? 'active' : ''} onClick={() => setTab('analytics')}>성과 분석</button>
          <button className={tab === 'install' ? 'active' : ''} onClick={() => setTab('install')}>SDK 설치</button>
        </div>

        {tab === 'mapping' ? (
          <div className="mapping-grid">
            <section className="editor-card">
              <div className="card-title">
                <div><span>영상 프리뷰</span><small>{videoUrl ? videoName : '기본 데모 장면'} · 제품 영역을 드래그해 지정하세요.</small></div>
                <div className="media-actions">
                  <input ref={fileInputRef} type="file" accept="video/*" onChange={handleVideoFile} hidden />
                  {videoUrl && <button className="remove-media" onClick={handleRemoveVideo}>영상 삭제</button>}
                  <button className="upload-media" onClick={() => fileInputRef.current?.click()}>{videoUrl ? '영상 변경' : '영상 업로드'}</button>
                </div>
              </div>
              <div className="editor-canvas">
                <div className="editor-video" ref={editorFrameRef}>
                  {videoUrl ? (
                    <video
                      ref={editorVideoRef}
                      src={videoUrl}
                      muted
                      playsInline
                      onPlay={() => setEditorPlaying(true)}
                      onPause={() => setEditorPlaying(false)}
                      onTimeUpdate={(event) => setEditorTime(event.currentTarget.currentTime)}
                      onLoadedMetadata={(event) => {
                        const duration = Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 15;
                        setDraft((current) => ({
                          ...current,
                          duration,
                          startTime: Math.min(current.startTime, Math.max(0, duration - .5)),
                          endTime: Math.min(Math.max(current.endTime, .5), duration),
                        }));
                      }}
                    />
                  ) : <FashionScene />}
                  <button
                    className="mapping-hotspot"
                    aria-label="제품 터치 영역"
                    style={{ left: `${draft.hotspot.x}%`, top: `${draft.hotspot.y}%`, width: `${draft.hotspot.width}%`, height: `${draft.hotspot.height}%` }}
                    onPointerDown={(event) => beginHotspotDrag('move', event)}
                    onPointerMove={moveHotspot}
                    onPointerUp={finishHotspotDrag}
                    onPointerCancel={finishHotspotDrag}
                  >
                    <span>{draft.productName || '상품 영역'}</span>
                    <i
                      aria-hidden="true"
                      onPointerDown={(event) => beginHotspotDrag('resize', event)}
                      onPointerMove={moveHotspot}
                      onPointerUp={finishHotspotDrag}
                      onPointerCancel={finishHotspotDrag}
                    />
                  </button>
                  <div className="editor-help">영역을 이동하고 오른쪽 아래 점으로 크기를 조절하세요</div>
                </div>
              </div>
              <div className="timeline">
                <div className="timeline-top"><button onClick={toggleEditorPlayback} disabled={!videoUrl}><Icon name={editorPlaying ? 'pause' : 'play'} /></button><span>{formatTime(editorTime)} / {formatTime(draft.duration)}</span><b>1개 제품 연결됨</b></div>
                <div className="timeline-track">
                  <span className="timeline-progress" style={{ width: `${Math.min(100, (editorTime / draft.duration) * 100)}%` }} />
                  <span className="timeline-product" style={{ left: `${(draft.startTime / draft.duration) * 100}%`, width: `${((draft.endTime - draft.startTime) / draft.duration) * 100}%` }}><i>{draft.productName}</i></span>
                  <span className="playhead" style={{ left: `${Math.min(100, (editorTime / draft.duration) * 100)}%` }} />
                </div>
                <div className="timeline-labels"><span>00:00</span><span>{formatTime(draft.duration / 3)}</span><span>{formatTime(draft.duration * 2 / 3)}</span><span>{formatTime(draft.duration)}</span></div>
                {uploadState && <div className="upload-state" role="status">{uploadState}</div>}
              </div>
            </section>

            <aside className="inspector-card">
              <div className="inspector-title"><div><span className="product-chip">P1</span><div><b>상품 연결 설정</b><small>AI 추천 신뢰도 96%</small></div></div><button aria-label="더보기">•••</button></div>
              <label>상품명<input value={draft.productName} onChange={(event) => updateDraft('productName', event.target.value)} /></label>
              <label>판매가<div className="price-input"><input inputMode="numeric" value={draft.price} onChange={(event) => updateDraft('price', event.target.value.replace(/[^0-9,]/g, ''))} /><span>원</span></div></label>
              <label>상품 URL<input value={draft.productUrl} onChange={(event) => updateDraft('productUrl', event.target.value)} /></label>
              <div className="time-fields">
                <label>등장 시작<input type="number" min="0" max={draft.endTime} step="0.1" value={Number(draft.startTime.toFixed(1))} onChange={(event) => updateDraft('startTime', Number(event.target.value))} /></label>
                <label>등장 종료<input type="number" min={draft.startTime} max={draft.duration} step="0.1" value={Number(draft.endTime.toFixed(1))} onChange={(event) => updateDraft('endTime', Number(event.target.value))} /></label>
              </div>
              <div className="ai-note"><Icon name="spark" /><div><b>{videoUrl ? '수동 제품 영역 지정 모드' : 'AI 추천 영역 예시'}</b><p>{videoUrl ? '영상 위 점선 영역을 실제 제품 위치에 맞추세요. 저장 즉시 시청자 데모에 반영됩니다.' : '다음 단계에서 프레임별 객체 추적을 연결할 예정입니다.'}</p></div></div>
              <button
                className={`save-button ${saveState === 'saved' ? 'saved' : ''} ${saveState === 'error' ? 'error' : ''}`}
                onClick={() => void saveDraft()}
                disabled={saveState === 'saving'}
              >
                {saveState === 'saving' ? 'API에 발행 중…' : saveState === 'saved' ? <><Icon name="check" /> 고객사 화면에 반영됨</> : saveState === 'error' ? 'API 연결 실패 · 다시 저장' : '연결 정보 저장 및 발행'}
              </button>
            </aside>
          </div>
        ) : tab === 'analytics' ? (
          <div className="analytics-view">
            <section className="metrics-grid">
              <MetricCard label="영상 완주율" value="78.4%" delta="12.8%" />
              <MetricCard label="제품 터치율" value="32.1%" delta="18.3%" accent />
              <MetricCard label="장바구니 전환" value="9.7%" delta="3.2%" />
              <MetricCard label="구매 전환율" value="6.8%" delta="1.9%" />
            </section>
            <section className="chart-card">
              <div className="chart-header"><div><h2>시간대별 제품 관심도</h2><p>제품 터치가 가장 많이 발생한 장면을 확인합니다.</p></div><select aria-label="분석 기간"><option>최근 7일</option><option>최근 30일</option></select></div>
              <div className="bar-chart">
                {bars.map((height, index) => <div key={index} className={index === 7 ? 'peak' : ''}><span style={{ height: `${height}%` }} /><small>{index + 5}초</small></div>)}
              </div>
              <div className="insight-banner"><Icon name="spark" /><div><b>12초 장면에서 관심이 가장 높습니다</b><p>가방 정면이 화면에 크게 보이는 구간입니다. 썸네일 장면으로 활용해 보세요.</p></div><button>장면 보기</button></div>
            </section>
          </div>
        ) : (
          <div className="install-view">
            <section className="install-guide">
              <span className="section-kicker">INSTALLATION</span>
              <h2>고객사 웹사이트에<br />두 단계로 연결합니다.</h2>
              <ol>
                <li><b>1</b><div><strong>SDK 스크립트 로드</strong><p>고객사 페이지에 클린터치 배포 파일을 한 번 추가합니다.</p></div></li>
                <li><b>2</b><div><strong>영상과 콘텐츠 ID 연결</strong><p>기존 video 요소의 선택자와 스튜디오 콘텐츠 ID를 전달합니다.</p></div></li>
              </ol>
              <a href="/partner.html">고객사 적용 예시 열기 ↗</a>
            </section>
            <section className="code-card">
              <header><div><span>지금 작동하는 로컬 설치 코드</span><small>Content ID · {CONTENT_ID}</small></div><button onClick={copyInstallCode}>{copied ? '복사 완료' : '코드 복사'}</button></header>
              <pre><code>{installCode}</code></pre>
              <div className="integration-status">
                <div><span className="status-dot" /><p><b>웹 SDK</b><small>로컬 배포 주소 연결됨</small></p></div>
                <div><span className="status-dot" /><p><b>Public Content API</b><small>{CONTENT_URL}</small></p></div>
                <div><span className="status-dot" /><p><b>Analytics API</b><small>실시간 이벤트 수집 연결됨</small></p></div>
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}

export default function App() {
  const [view, setView] = useState<View>('experience');
  const [mapping, setMapping] = useState<ProductMapping>(() => loadMapping());
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoName, setVideoName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadStoredVideo().then((asset) => {
      if (!asset || cancelled) return;
      setVideoUrl(URL.createObjectURL(asset.blob));
      setVideoName(asset.name);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
  }, [videoUrl]);

  const handleSave = async (nextMapping: ProductMapping) => {
    saveMapping(nextMapping);
    setMapping(nextMapping);
    await publishMapping(nextMapping);
  };

  const handleVideoUpload = async (file: File) => {
    const asset = await storeVideo(file);
    setVideoUrl(URL.createObjectURL(asset.blob));
    setVideoName(asset.name);
  };

  const handleVideoRemove = async () => {
    await removeStoredVideo();
    setVideoUrl(null);
    setVideoName(null);
    const next = { ...mapping, duration: 15, startTime: 4, endTime: 13 };
    handleSave(next);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView('experience')} aria-label="클린터치 홈"><BrandMark /><b>CleanTouch</b><em>BETA</em></button>
        <nav aria-label="주요 화면">
          <button className={view === 'experience' ? 'active' : ''} onClick={() => setView('experience')}>SDK 미리보기</button>
          <button className={view === 'studio' ? 'active' : ''} onClick={() => setView('studio')}>판매자 스튜디오</button>
        </nav>
        <div className="topbar-meta"><span className="live-dot" /> {videoUrl ? '업로드 영상 저장됨' : 'Interactive demo'}</div>
      </header>
      {view === 'experience' ? (
        <ViewerDemo mapping={mapping} videoUrl={videoUrl} videoName={videoName} />
      ) : (
        <Studio
          mapping={mapping}
          videoUrl={videoUrl}
          videoName={videoName}
          onSave={handleSave}
          onVideoUpload={handleVideoUpload}
          onVideoRemove={handleVideoRemove}
        />
      )}
    </div>
  );
}
