const pptxgen = require('pptxgenjs');
const path = require('node:path');

const pptx = new pptxgen();
pptx.defineLayout({ name: 'WIDE', width: 13.333, height: 7.5 });
pptx.layout = 'WIDE';
pptx.author = 'CleanTouch Project';
pptx.subject = 'CleanTouch 프로젝트 진행사항';
pptx.title = 'CleanTouch 진행사항 발표';
pptx.lang = 'ko-KR';
pptx.theme = { headFontFace: 'Malgun Gothic', bodyFontFace: 'Malgun Gothic', lang: 'ko-KR' };

const C = {
  bg: 'F3F7F8', white: 'FFFFFF', ink: '14272E', gray: '6E7F86', line: 'D9E3E6',
  teal: '38C9DF', tealDark: '168CA3', tealPale: 'DFF8FC', violet: '6550B6',
  violetPale: 'EEEAFB', mint: 'E5F8F2', mintDark: '18866E', dark: '0A1A20',
};

const mockup = path.resolve('idea/cleantouch-product-mockup.png');
const result = path.resolve('artifacts/device-tests/scroll-result.png');

function base(slide, step, title, subtitle) {
  slide.background = { color: C.bg };
  slide.addText('CLEANTOUCH · PROJECT PROGRESS', {
    x: 0.62, y: 0.36, w: 4.4, h: 0.22, fontFace: 'Malgun Gothic', fontSize: 7.5,
    bold: true, charSpacing: 1.2, color: C.tealDark, margin: 0,
  });
  for (let i = 1; i <= 5; i++) {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 9.85 + (i - 1) * 0.53, y: 0.37, w: 0.38, h: 0.14,
      rectRadius: 0.04,
      fill: { color: i <= step ? C.teal : C.line },
      line: { color: i <= step ? C.teal : C.line },
    });
  }
  slide.addText(`${step} / 5`, {
    x: 12.55, y: 0.33, w: 0.35, h: 0.2, fontFace: 'Malgun Gothic', fontSize: 7.5,
    bold: true, color: C.gray, align: 'right', margin: 0,
  });
  slide.addText(title, {
    x: 0.62, y: 0.88, w: 11.9, h: 0.58, fontFace: 'Malgun Gothic', fontSize: 26,
    bold: true, color: C.ink, margin: 0, fit: 'shrink',
  });
  slide.addText(subtitle, {
    x: 0.64, y: 1.58, w: 11.5, h: 0.36, fontFace: 'Malgun Gothic', fontSize: 10.5,
    color: C.gray, margin: 0, fit: 'shrink',
  });
  slide.addText('CleanTouch', {
    x: 0.48, y: 7.16, w: 1.2, h: 0.18, fontFace: 'Malgun Gothic', fontSize: 7,
    bold: true, color: 'A1AFB3', margin: 0,
  });
}

function card(slide, x, y, w, h, number, title, body, color = C.teal) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.1, fill: { color: C.white }, line: { color: C.line, width: 1 },
  });
  slide.addShape(pptx.ShapeType.ellipse, {
    x: x + 0.28, y: y + 0.3, w: 0.58, h: 0.58,
    fill: { color }, line: { color },
  });
  slide.addText(number, {
    x: x + 0.36, y: y + 0.49, w: 0.42, h: 0.14, fontFace: 'Malgun Gothic',
    fontSize: 7.5, bold: true, color: C.white, align: 'center', margin: 0,
  });
  slide.addText(title, {
    x: x + 1.05, y: y + 0.32, w: w - 1.35, h: 0.35, fontFace: 'Malgun Gothic',
    fontSize: 14, bold: true, color: C.ink, margin: 0, fit: 'shrink',
  });
  slide.addText(body, {
    x: x + 1.05, y: y + 0.91, w: w - 1.35, h: h - 1.18, fontFace: 'Malgun Gothic',
    fontSize: 10.5, color: C.gray, margin: 0, fit: 'shrink', valign: 'top',
  });
}

// 1. 아이디어 출발
{
  const slide = pptx.addSlide();
  base(slide, 1, '아이디어 출발 — 영상은 가리지 않고, 상품은 쉽게 찾기', '쇼츠 영상의 상품 정보가 화면을 가리는 불편에서 시작했습니다.');
  slide.addImage({ path: mockup, x: 7.35, y: 2.18, w: 5.35, h: 3.01 });
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.68, y: 2.2, w: 5.95, h: 3.7, rectRadius: 0.12,
    fill: { color: C.white }, line: { color: C.line },
  });
  slide.addText('발견한 문제', {
    x: 1.08, y: 2.62, w: 2.1, h: 0.35, fontFace: 'Malgun Gothic', fontSize: 14,
    bold: true, color: C.violet, margin: 0,
  });
  slide.addText('• 상품명·가격·링크가 영상 내용을 가림\n• 정보가 없으면 영상 속 상품을 직접 찾기 어려움\n• 사용자가 궁금할 때만 정보가 필요함', {
    x: 1.08, y: 3.28, w: 4.75, h: 1.5, fontFace: 'Malgun Gothic', fontSize: 12,
    color: C.ink, margin: 0, fit: 'shrink', paraSpaceAfterPt: 9,
  });
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.95, y: 5.18, w: 5.35, h: 0.52, rectRadius: 0.07,
    fill: { color: C.tealPale }, line: { color: C.tealPale },
  });
  slide.addText('목표  |  사용자가 원하는 순간에만 상품 정보를 연결', {
    x: 1.18, y: 5.35, w: 4.9, h: 0.18, fontFace: 'Malgun Gothic', fontSize: 10,
    bold: true, color: C.tealDark, align: 'center', margin: 0, fit: 'shrink',
  });
  slide.addNotes('처음에는 쇼츠 위 상품 정보가 옷이나 중요한 장면을 가리는 불편에서 출발했습니다. 정보를 계속 보여주지 않고 사용자가 궁금한 순간에만 상품을 찾는 것을 목표로 정했습니다.');
}

// 2. 방향 수정
{
  const slide = pptx.addSlide();
  base(slide, 2, '현실성 검토 — SDK에서 사용자 스캔 앱으로 방향 수정', 'YouTube와 Instagram의 플레이어를 외부에서 수정할 수 없다는 한계를 반영했습니다.');
  card(slide, 0.72, 2.25, 5.2, 3.6, '01', '초기 구상', '영상 속 상품을 직접 터치\n영상 서비스가 SDK를 설치\n상품 위치와 정보를 사전 등록', C.violet);
  slide.addShape(pptx.ShapeType.chevron, {
    x: 6.18, y: 3.47, w: 0.9, h: 1.05, fill: { color: C.teal }, line: { color: C.teal },
  });
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 7.35, y: 2.25, w: 5.2, h: 3.6, rectRadius: 0.1,
    fill: { color: C.dark }, line: { color: C.dark },
  });
  slide.addShape(pptx.ShapeType.ellipse, {
    x: 7.63, y: 2.55, w: 0.58, h: 0.58, fill: { color: C.teal }, line: { color: C.teal },
  });
  slide.addText('02', {
    x: 7.71, y: 2.74, w: 0.42, h: 0.14, fontFace: 'Malgun Gothic', fontSize: 7.5,
    bold: true, color: C.dark, align: 'center', margin: 0,
  });
  slide.addText('현재 방식', {
    x: 8.68, y: 2.57, w: 2.8, h: 0.35, fontFace: 'Malgun Gothic', fontSize: 14,
    bold: true, color: C.white, margin: 0,
  });
  slide.addText('Android 플로팅 버튼으로 실행\n현재 화면 한 장을 AI로 분석\n사용자가 상품 위치를 직접 보정', {
    x: 8.68, y: 3.15, w: 3.15, h: 1.5, fontFace: 'Malgun Gothic', fontSize: 11,
    color: 'D5E1E4', margin: 0, fit: 'shrink', paraSpaceAfterPt: 9,
  });
  slide.addText('플랫폼이 설치해야 하는 기능  →  사용자가 직접 실행하는 서비스', {
    x: 7.82, y: 5.18, w: 4.25, h: 0.25, fontFace: 'Malgun Gothic', fontSize: 10,
    bold: true, color: C.teal, align: 'center', margin: 0, fit: 'shrink',
  });
  slide.addNotes('처음에는 영상 서비스가 SDK를 설치하는 방식을 생각했습니다. 하지만 유튜브나 인스타그램을 외부에서 수정할 수 없었습니다. 그래서 Android 화면 공유와 플로팅 버튼을 이용해 사용자가 직접 현재 화면을 스캔하는 방식으로 바꿨습니다.');
}

// 3. 구현
{
  const slide = pptx.addSlide();
  base(slide, 3, '개발 진행 — 실제 Android 앱과 검색 서버 구현', '웹 시제품에서 시작해 다른 앱 위에서 동작하는 네이티브 앱까지 만들었습니다.');
  const steps = [
    ['01', '스캔 시작', 'Android 전체 화면 공유 승인'],
    ['02', '플로팅 버튼', '다른 앱 위에서 이동·실행'],
    ['03', '화면 캡처', '누른 순간 한 화면만 생성'],
    ['04', 'AI 검색', '확대 상품 영역 특징 분석'],
    ['05', '구매 연결', 'Naver·Google Shopping'],
  ];
  steps.forEach((s, i) => {
    const x = 0.55 + i * 2.56;
    slide.addShape(pptx.ShapeType.roundRect, {
      x, y: 2.45, w: 2.15, h: 2.35, rectRadius: 0.1,
      fill: { color: i === 4 ? C.dark : C.white },
      line: { color: i === 4 ? C.dark : C.line },
    });
    slide.addText(s[0], {
      x: x + 0.22, y: 2.76, w: 0.45, h: 0.2, fontFace: 'Malgun Gothic', fontSize: 8,
      bold: true, color: i === 4 ? C.teal : C.tealDark, margin: 0,
    });
    slide.addText(s[1], {
      x: x + 0.22, y: 3.25, w: 1.7, h: 0.35, fontFace: 'Malgun Gothic', fontSize: 13,
      bold: true, color: i === 4 ? C.white : C.ink, margin: 0, fit: 'shrink',
    });
    slide.addText(s[2], {
      x: x + 0.22, y: 3.92, w: 1.7, h: 0.5, fontFace: 'Malgun Gothic', fontSize: 8.8,
      color: i === 4 ? 'D5E1E4' : C.gray, margin: 0, fit: 'shrink',
    });
    if (i < 4) slide.addShape(pptx.ShapeType.chevron, { x: x + 2.22, y: 3.35, w: 0.25, h: 0.52, fill: { color: C.gray }, line: { color: C.gray } });
  });
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 1.38, y: 5.42, w: 10.55, h: 0.76, rectRadius: 0.08,
    fill: { color: C.tealPale }, line: { color: C.tealPale },
  });
  slide.addText('추가 구현  |  자동 인식 실패 시 위치 지정 · 작게/보통/넓게 확대 · 회전 대응 · 이미지 자동 삭제', {
    x: 1.68, y: 5.66, w: 9.95, h: 0.25, fontFace: 'Malgun Gothic', fontSize: 10,
    bold: true, color: C.tealDark, align: 'center', margin: 0, fit: 'shrink',
  });
  slide.addNotes('현재는 실제 Android 앱과 검색 서버가 연결되어 있습니다. 전체 화면 공유를 허용한 뒤 다른 앱에서 버튼을 누르면 한 화면을 캡처하고, 확대된 상품 영역을 AI가 분석해 쇼핑 검색으로 연결합니다.');
}

// 4. 테스트와 수정
{
  const slide = pptx.addSlide();
  base(slide, 4, '테스트와 수정 — 작은 가방 인식부터 오류 대응까지', '직접 기기에서 반복 사용하면서 발견한 문제를 수정했습니다.');
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.7, y: 2.2, w: 2.48, h: 4.35, rectRadius: 0.13,
    fill: { color: C.white }, line: { color: C.line },
  });
  slide.addImage({ path: result, x: 0.9, y: 2.34, w: 2.08, h: 4.12 });
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 3.58, y: 2.2, w: 9.05, h: 4.35, rectRadius: 0.13,
    fill: { color: C.white }, line: { color: C.line },
  });
  slide.addText('실제 결과', {
    x: 3.98, y: 2.58, w: 1.4, h: 0.3, fontFace: 'Malgun Gothic', fontSize: 11,
    bold: true, color: C.tealDark, margin: 0,
  });
  slide.addText('작게 보이는 검은색 가방 → 검정색 미니 숄더백 계열 인식', {
    x: 3.98, y: 3.03, w: 7.9, h: 0.5, fontFace: 'Malgun Gothic', fontSize: 17,
    bold: true, color: C.ink, margin: 0, fit: 'shrink',
  });
  const fixes = [
    ['검색 결과 없음', '상품 위치 지정 화면 자동 표시'],
    ['화면 회전', '결과 유지·중복 AI 요청 방지'],
    ['무료 AI 한도', '서버 장애와 구분해 안내'],
    ['반복 검색', '이전 이미지 메모리 정리'],
  ];
  fixes.forEach((f, i) => {
    const x = 3.98 + (i % 2) * 4.08;
    const y = 3.88 + Math.floor(i / 2) * 1.02;
    slide.addText(f[0], {
      x, y, w: 1.35, h: 0.25, fontFace: 'Malgun Gothic', fontSize: 9, bold: true,
      color: i % 2 ? C.violet : C.tealDark, margin: 0, fit: 'shrink',
    });
    slide.addText(f[1], {
      x: x + 1.45, y, w: 2.35, h: 0.28, fontFace: 'Malgun Gothic', fontSize: 8.8,
      color: C.gray, margin: 0, fit: 'shrink',
    });
  });
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 3.98, y: 5.87, w: 7.82, h: 0.42, rectRadius: 0.06,
    fill: { color: C.mint }, line: { color: C.mint },
  });
  slide.addText('검증 완료  |  서버 자동 테스트 16개 · Android 빌드 성공 · 린트 오류 0개', {
    x: 4.2, y: 6.0, w: 7.38, h: 0.16, fontFace: 'Malgun Gothic', fontSize: 9,
    bold: true, color: C.mintDark, align: 'center', margin: 0, fit: 'shrink',
  });
  slide.addNotes('실제 작은 가방을 검정색 미니 숄더백 계열로 인식했습니다. 테스트하면서 결과 없음, 화면 회전, 무료 한도, 이미지 메모리 문제를 발견해 수정했습니다. 서버 테스트 16개, Android 빌드와 린트도 통과했습니다.');
}

// 5. 현재 상태와 다음 단계
{
  const slide = pptx.addSlide();
  slide.background = { color: C.dark };
  slide.addText('CLEANTOUCH · CURRENT STATUS', {
    x: 0.65, y: 0.48, w: 4.2, h: 0.22, fontFace: 'Malgun Gothic', fontSize: 7.5,
    bold: true, charSpacing: 1.2, color: C.teal, margin: 0,
  });
  slide.addText('현재 상태와 다음 단계', {
    x: 0.65, y: 1.03, w: 7, h: 0.62, fontFace: 'Malgun Gothic', fontSize: 29,
    bold: true, color: C.white, margin: 0,
  });
  slide.addText('실제 동작하는 시제품은 완성됐고, 이제 정확도와 사업성을 검증할 단계입니다.', {
    x: 0.67, y: 1.82, w: 8.7, h: 0.35, fontFace: 'Malgun Gothic', fontSize: 11,
    color: 'C7D5D9', margin: 0,
  });
  const cols = [
    ['현재 완료', 'Android 앱 v0.2.1\nAI 검색 서버 연결\n위치 지정·오류 대응\n실제 작은 상품 인식'],
    ['남은 한계', '무료 AI 사용량 제한\n개발 PC에서 서버 실행\n정확한 동일 상품은 미확정\n상품 가격 DB 미연동'],
    ['다음 진행', '가방 중심 쇼츠 50개 테스트\n사용자 20~50명 검증\nHTTPS 클라우드 서버\n첫 상품 DB 파트너 연결'],
  ];
  cols.forEach((c, i) => {
    const x = 0.68 + i * 4.15;
    slide.addShape(pptx.ShapeType.roundRect, {
      x, y: 2.73, w: 3.72, h: 3.08, rectRadius: 0.11,
      fill: { color: i === 2 ? C.teal : '142B33' },
      line: { color: i === 2 ? C.teal : '35515B' },
    });
    slide.addText(c[0], {
      x: x + 0.3, y: 3.08, w: 2.7, h: 0.35, fontFace: 'Malgun Gothic', fontSize: 14,
      bold: true, color: i === 2 ? C.dark : C.white, margin: 0,
    });
    slide.addText(c[1], {
      x: x + 0.3, y: 3.75, w: 3.0, h: 1.5, fontFace: 'Malgun Gothic', fontSize: 10.5,
      color: i === 2 ? C.ink : 'D3E0E3', margin: 0, fit: 'shrink', paraSpaceAfterPt: 8,
    });
  });
  slide.addText('“사용자가 원하는 순간에만 상품 정보와 자연스럽게 연결한다.”', {
    x: 1.5, y: 6.35, w: 10.3, h: 0.38, fontFace: 'Malgun Gothic', fontSize: 14,
    italic: true, color: C.white, align: 'center', margin: 0, fit: 'shrink',
  });
  slide.addText('5 / 5', {
    x: 12.4, y: 7.13, w: 0.45, h: 0.18, fontFace: 'Malgun Gothic', fontSize: 7,
    bold: true, color: '8AA0A6', align: 'right', margin: 0,
  });
  slide.addNotes('현재 실제 동작하는 Android 시제품과 검색 서버까지 완성했습니다. 다음은 가방 카테고리와 실제 쇼츠를 이용해 정확도와 사용자 반응을 검증하고, 클라우드 서버와 상품 DB 파트너로 연결하는 단계입니다.');
}

pptx.writeFile({ fileName: path.resolve('presentation/CleanTouch_진행사항_5장.pptx') });
