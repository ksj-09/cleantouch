import { useEffect, useRef, useState } from 'react';

type Phase = 'idle' | 'recording' | 'analyzing' | 'complete';
type FoundProduct = { id: string; name: string; category: string; color: string; time: number };
const demoProducts: FoundProduct[] = [
  { id: 'bag', name: '블랙 미니 숄더백', category: '가방', color: '#36343e', time: 1 },
  { id: 'jacket', name: '크림 크롭 재킷', category: '의류', color: '#e1d6c3', time: 4 },
  { id: 'shoes', name: '화이트 로우 스니커즈', category: '신발', color: '#efede8', time: 7 },
];
function Mark({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <path d="M18 6H9a3 3 0 0 0-3 3v9m24-12h9a3 3 0 0 1 3 3v9M6 30v9a3 3 0 0 0 3 3h9m24-12v9a3 3 0 0 1-3 3h-9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    <path d="m24 10 5 9 9 5-9 5-5 9-5-9-9-5 9-5Z" fill="currentColor" />
    <path d="m24 18 2 4 4 2-4 2-2 4-2-4-4-2 4-2Z" fill="#7ae7c7" />
  </svg>;
}
function ProductImage({ product }: { product: FoundProduct }) {
  return <svg viewBox="0 0 120 120" className="product-art" aria-hidden="true">
    <ellipse cx="60" cy="99" rx="35" ry="5" fill="#000" opacity=".1" />
    {product.id === 'bag' ? <>
      <path d="M37 61V44c0-29 46-29 46 0v17" stroke={product.color} strokeWidth="6" fill="none" />
      <path d="M25 50h70l-5 42q-30 12-60 0Z" fill={product.color} /><rect x="54" y="56" width="12" height="6" rx="2" fill="#baaa77" />
    </> : product.id === 'jacket' ? <>
      <path d="m39 27 21 8 21-8 24 31-15 12-10-13v37H40V57L30 70 15 58Z" fill={product.color} />
      <path d="m40 28 20 7-10 22-10-9m40-20-20 7 10 22 10-9M60 35v59" stroke="#ac9a87" strokeWidth="2" fill="none" />
      <circle cx="65" cy="68" r="2" fill="#665746" /><circle cx="65" cy="82" r="2" fill="#665746" />
    </> : <>
      <path d="m25 48 25 8 13 16 37 11q13 6 5 14H18q-10-8-3-19Z" fill={product.color} stroke="#b6b7bc" strokeWidth="2" />
      <path d="M17 91h88M51 63l-12 8m20 0-12 8m20-1-10 8" stroke="#b6b7bc" strokeWidth="3" />
    </>}
  </svg>;
}
const formatTime = (seconds: number) => Math.floor(seconds / 60).toString().padStart(2, '0') + ':' + (seconds % 60).toString().padStart(2, '0');

export default function ScanApp() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [watching, setWatching] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('전체');
  const [consent, setConsent] = useState(false);
  const [found, setFound] = useState<FoundProduct[]>([]);
  const startedAt = useRef(0);
  const on = phase === 'recording';
  const analyzing = phase === 'analyzing';

  useEffect(() => {
    if (!on) return;
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 250);
    return () => window.clearInterval(timer);
  }, [on]);
  useEffect(() => {
    if (!analyzing) return;
    const timer = window.setTimeout(() => {
      setFound(demoProducts.filter(product => product.time <= elapsed));
      setPhase('complete');
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [analyzing, elapsed]);

  function start() {
    startedAt.current = Date.now();
    setElapsed(0); setFound([]); setQuery(''); setCategory('전체'); setPhase('recording'); setConsent(false);
  }
  function stop() {
    if (!on) return;
    setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    setWatching(false); setPhase('analyzing');
  }
  const visible = found.filter(product => (category === '전체' || product.category === category) && product.name.includes(query));

  return <main className="experience">
    <section className="story">
      <a className="wordmark" href="/"><Mark /><span>CleanTouch</span></a>
      <div className="story-copy">
        <span className="eyebrow">YOUR SCREEN. YOUR FINDS.</span>
        <h1>켜고, 둘러보고.<br /><em>끄면, 모입니다.</em></h1>
        <p>마음에 들었던 가방, 스쳐 지나간 재킷.<br />보던 화면 속 취향을 한곳에 담아두세요.</p>
        <ol>
          <li><span>01</span><div><b>원형 버튼으로 ON</b><p>CleanTouch 앱에서 화면 녹화를 시작해요.</p></div></li>
          <li><span>02</span><div><b>평소처럼 둘러보기</b><p>다른 앱 위에 뜨는 버튼 없이 자유롭게 봐요.</p></div></li>
          <li><span>03</span><div><b>OFF 하면 자동 분석</b><p>인식한 상품 전체를 사진과 함께 확인해요.</p></div></li>
        </ol>
      </div>
      <footer><span className="status-dot" /> ANDROID APP EXPERIENCE <a href="/studio.html">스튜디오 ↗</a></footer>
    </section>
    <section className="preview">
      <div className="preview-label"><span>LIVE PREVIEW</span><p>버튼을 눌러 새로운 흐름을 체험하세요</p></div>
      <div className="device">
        <div className="island" />
        <div className="phone-status"><b>9:41</b><span>{on && <Mark />} ▰ ▮</span></div>
        {watching ? <div className="watch-demo">
          <video src="/partner-fashion-demo.webm" autoPlay muted loop playsInline />
          <div className="video-caption"><b>오늘의 데일리룩</b><p>이 화면은 다른 앱을 보는 상황의 예시입니다.</p></div>
        </div> : <>
          <header className="app-header"><Mark /><b>CleanTouch</b><span>DISCOVER</span></header>
          {phase === 'idle' || on ? <div className="home-content">
            <span className={'mode-label ' + (on ? 'active' : '')}><i />{on ? 'SCREEN RECORDING' : 'READY WHEN YOU ARE'}</span>
            <h2>{on ? <>취향을 담는 중</> : <>마음에 든 순간을,<br />한 번에 모아보세요.</>}</h2>
            <p>{on ? '다른 앱을 자유롭게 둘러보세요.' : '켜고 둘러본 뒤, 끄면 상품이 모입니다.'}</p>
            <div className={'power-rings ' + (on ? 'on' : '')}>
              <button className="power-button" aria-label={on ? '스캔 종료하고 자동 분석' : '화면 스캔 켜기'} aria-pressed={on} onClick={on ? stop : () => setConsent(true)}>
                <Mark /><strong>{on ? 'ON' : 'OFF'}</strong><small>{on ? '눌러서 종료' : '눌러서 시작'}</small>
              </button>
            </div>
            <div className="elapsed">{on ? formatTime(elapsed) : 'ONE TOUCH TO DISCOVER'}</div>
            <div className="info-card"><span>✦</span><div><b>{on ? '끄면 자동으로 분석해요' : '버튼 하나로 시작과 종료'}</b><p>{on ? '앱으로 돌아와 원형 버튼을 꺼 주세요. 별도의 분석 버튼을 누를 필요 없어요.' : '녹화 중에는 평소처럼 영상을 보세요. 종료하면 인식한 상품을 모아드려요.'}</p></div></div>
            <small className="retention">무음 녹화 · 분석 완료 후 원본 자동 삭제</small>
          </div> : <section className="results" aria-label="분석한 전체 상품">
            <span className="mode-label active"><i />{analyzing ? 'ANALYZING' : 'YOUR COLLECTION'}</span>
            <h2>{analyzing ? <>담아온 화면을<br />살펴보고 있어요.</> : '내 화면에서 찾은 상품'}</h2>
            <p className="result-meta">녹화 {formatTime(elapsed)} <span>·</span> {analyzing ? '장면별로 상품을 모으는 중' : '인식한 상품 ' + found.length + '개'}</p>
            {analyzing ? <div className="analysis-progress" role="status"><Mark /><p>녹화 종료 · 자동 분석 중</p><div /></div> : <>
              <div className="example-note">예시 결과 · 실제 인식과 가격 정보는 Android 앱에서 확인해요.</div>
              <input className="search-products" aria-label="상품 이름으로 찾기" value={query} onChange={e => setQuery(e.target.value)} placeholder="상품 이름으로 찾기" />
              <div className="filters">{['전체', '가방', '의류', '신발'].map(item => <button key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div>
              <div className="product-list">{visible.map(product => <article className="product-card" key={product.id}>
                <div className="product-thumb"><ProductImage product={product} /></div>
                <div><small>{product.category} · {formatTime(product.time)}에 등장</small><h3>{product.name}</h3><a href={'https://search.shopping.naver.com/search/all?query=' + encodeURIComponent(product.name)} target="_blank" rel="noreferrer">비슷한 상품 찾기 ↗</a></div>
              </article>)}</div>
              {visible.length === 0 && <p className="empty">{found.length ? '검색어에 맞는 상품이 없어요.' : '스캔 시간이 짧아 예시 상품을 모으지 못했어요.'}</p>}
              <button className="new-scan" onClick={() => setConsent(true)}>새 화면 스캔 시작</button>
            </>}
          </section>}
        </>}
        {consent && <div className="consent-shade"><section className="consent" role="dialog" aria-label="화면 녹화 안내" aria-modal="true">
          <Mark /><h3>화면 스캔 체험</h3><p>웹에서는 조작 흐름과 예시 결과를 보여드려요. 실제 화면 녹화와 상품 인식은 Android 앱에서 작동합니다.</p>
          <button onClick={start}>체험 시작</button><button className="cancel" onClick={() => setConsent(false)}>취소</button>
        </section></div>}
      </div>
      <div className="preview-controls">
        {on && <button onClick={() => setWatching(!watching)}>{watching ? '← CleanTouch 앱으로 돌아가기' : '다른 앱을 보는 상황 체험 →'}</button>}
        <p>조작 체험용 웹 시제품 · 실제 화면 녹화 없음</p>
      </div>
    </section>
  </main>;
}
