const pptxgen = require('pptxgenjs');
const path = require('node:path');

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'CleanTouch Project';
pptx.subject = 'CleanTouch 프로젝트 진행사항 발표';
pptx.title = 'CleanTouch — 영상 속 상품을 원하는 순간 바로 찾는 서비스';
pptx.company = 'CleanTouch';
pptx.lang = 'ko-KR';
pptx.theme = {
  headFontFace: 'Malgun Gothic',
  bodyFontFace: 'Malgun Gothic',
  lang: 'ko-KR',
};
pptx.defineLayout({ name: 'CUSTOM_WIDE', width: 13.333, height: 7.5 });
pptx.layout = 'CUSTOM_WIDE';

const C = {
  ink: '14272E',
  ink2: '263A42',
  teal: '38C9DF',
  tealDark: '168CA3',
  tealPale: 'DFF8FC',
  mint: 'E5F8F2',
  mintDark: '18866E',
  violet: '6550B6',
  violetPale: 'EEEAFB',
  paper: 'F3F7F8',
  white: 'FFFFFF',
  gray: '708087',
  gray2: 'A4B0B4',
  line: 'D8E2E5',
  darkBg: '09181E',
  warning: 'FFF2D9',
  warningText: '8A5A00',
};

const mockup = path.resolve('idea/cleantouch-product-mockup.png');
const resultPortrait = path.resolve('artifacts/device-tests/scroll-result.png');
const resultLandscape = path.resolve('artifacts/device-tests/rotated-result.png');
const appHome = path.resolve('artifacts/device-tests/home2.png');
const productScreen = path.resolve('artifacts/device-tests/product-screen.png');

function addFooter(slide, page, dark = false) {
  slide.addText('CleanTouch', {
    x: 0.45, y: 7.14, w: 1.6, h: 0.2,
    fontFace: 'Malgun Gothic', fontSize: 7.5, bold: true,
    color: dark ? 'D7E4E7' : C.gray2, margin: 0,
  });
  slide.addText(String(page).padStart(2, '0'), {
    x: 12.35, y: 7.12, w: 0.5, h: 0.2,
    fontFace: 'Malgun Gothic', fontSize: 7.5,
    color: dark ? 'D7E4E7' : C.gray2, align: 'right', margin: 0,
  });
}

function addTitle(slide, eyebrow, title, subtitle) {
  slide.addText(eyebrow.toUpperCase(), {
    x: 0.6, y: 0.38, w: 4.5, h: 0.25,
    fontFace: 'Malgun Gothic', fontSize: 8.5, bold: true,
    charSpacing: 1.4, color: C.tealDark, margin: 0,
  });
  slide.addText(title, {
    x: 0.6, y: 0.75, w: 12.1, h: 0.62,
    fontFace: 'Malgun Gothic', fontSize: 25, bold: true,
    color: C.ink, margin: 0, breakLine: false, fit: 'shrink',
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.62, y: 1.48, w: 11.7, h: 0.42,
      fontFace: 'Malgun Gothic', fontSize: 10.5,
      color: C.gray, margin: 0, fit: 'shrink',
    });
  }
}

function addPill(slide, text, x, y, w, fill = C.tealPale, color = C.tealDark) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h: 0.36, rectRadius: 0.08,
    fill: { color: fill }, line: { color: fill },
  });
  slide.addText(text, {
    x: x + 0.06, y: y + 0.075, w: w - 0.12, h: 0.16,
    fontFace: 'Malgun Gothic', fontSize: 7.5, bold: true,
    align: 'center', color, margin: 0, fit: 'shrink',
  });
}

function addCard(slide, x, y, w, h, title, body, accent = C.teal) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h,
    rectRadius: 0.12,
    fill: { color: C.white },
    line: { color: C.line, width: 1 },
    shadow: { type: 'outer', color: 'AEBFC4', opacity: 0.16, blur: 1.5, angle: 45, distance: 1 },
  });
  slide.addShape(pptx.ShapeType.roundRect, {
    x: x + 0.28, y: y + 0.3, w: 0.12, h: 0.56,
    rectRadius: 0.04, fill: { color: accent }, line: { color: accent },
  });
  slide.addText(title, {
    x: x + 0.55, y: y + 0.28, w: w - 0.82, h: 0.36,
    fontFace: 'Malgun Gothic', fontSize: 14, bold: true,
    color: C.ink, margin: 0, fit: 'shrink',
  });
  slide.addText(body, {
    x: x + 0.55, y: y + 0.88, w: w - 0.82, h: h - 1.15,
    fontFace: 'Malgun Gothic', fontSize: 10.2,
    color: C.gray, breakLine: false, valign: 'top',
    margin: 0, breakLine: false, fit: 'shrink',
    paraSpaceAfterPt: 7, bullet: body.includes('\n') ? { type: 'bullet' } : undefined,
  });
}

function addNotes(slide, text) {
  slide.addNotes(text.replace(/^\s+/gm, '').trim());
}

// 1. Title
{
  const slide = pptx.addSlide();
  slide.background = { color: C.darkBg };
  slide.addImage({ path: mockup, x: 0, y: 0, w: 13.333, h: 7.5, transparency: 2 });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 13.333, h: 7.5,
    fill: { color: '061318', transparency: 32 }, line: { color: '061318', transparency: 100 },
  });
  addPill(slide, 'ANDROID PROTOTYPE · v0.2.1', 0.7, 0.63, 2.65, 'DFF8FC', C.tealDark);
  slide.addText('영상 속 상품을\n원하는 순간 바로 찾다', {
    x: 0.68, y: 1.32, w: 6.5, h: 1.75,
    fontFace: 'Malgun Gothic', fontSize: 34, bold: true,
    color: C.white, margin: 0, breakLine: false, fit: 'shrink',
    breakLine: false,
  });
  slide.addText('CleanTouch', {
    x: 0.7, y: 3.35, w: 4.4, h: 0.6,
    fontFace: 'Malgun Gothic', fontSize: 25, bold: true,
    color: C.teal, margin: 0,
  });
  slide.addText('아이디어 구체화부터 실제 Android 앱·AI 검색 서버 구현까지', {
    x: 0.72, y: 4.03, w: 5.8, h: 0.5,
    fontFace: 'Malgun Gothic', fontSize: 11.5,
    color: 'E3ECEE', margin: 0, fit: 'shrink',
  });
  slide.addShape(pptx.ShapeType.line, { x: 0.72, y: 4.75, w: 3.8, h: 0, line: { color: C.teal, width: 2 } });
  slide.addText('PROJECT PROGRESS PRESENTATION', {
    x: 0.72, y: 4.92, w: 4.4, h: 0.25,
    fontFace: 'Malgun Gothic', fontSize: 7.5, bold: true,
    color: 'D1DDE0', charSpacing: 1.6, margin: 0,
  });
  addFooter(slide, 1, true);
  addNotes(slide, `CleanTouch는 쇼츠를 보다가 궁금한 상품이 등장하면 플로팅 버튼 한 번으로 화면을 분석하고 쇼핑 검색으로 연결하는 앱입니다. 오늘은 문제를 발견한 과정, 아이디어가 바뀐 이유, 현재 구현 결과와 다음 단계까지 말씀드리겠습니다.`);
}

// 2. Problem
{
  const slide = pptx.addSlide();
  slide.background = { color: C.paper };
  addTitle(slide, '01 · PROBLEM', '정보를 보여줄수록, 영상은 더 가려진다', '쇼츠 커머스의 정보 전달과 영상 몰입 사이에는 충돌이 있습니다.');
  addCard(slide, 0.65, 2.15, 5.75, 3.15, '정보가 계속 보일 때', '상품명·가격·구매 링크가 옷의 핏과 중요한 장면을 가림\n시청 몰입과 영상 완주를 방해할 수 있음', C.violet);
  addCard(slide, 6.92, 2.15, 5.75, 3.15, '정보가 전혀 없을 때', '궁금한 가방·옷·신발을 사용자가 직접 검색해야 함\n브랜드나 모델을 모르면 구매까지 이어지기 어려움', C.teal);
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 2.1, y: 5.68, w: 9.15, h: 0.75,
    rectRadius: 0.1, fill: { color: C.ink }, line: { color: C.ink },
  });
  slide.addText('핵심 질문  |  정보를 계속 띄우지 않고, 사용자가 원하는 순간에만 연결할 수 없을까?', {
    x: 2.35, y: 5.91, w: 8.65, h: 0.25,
    fontFace: 'Malgun Gothic', fontSize: 12, bold: true,
    color: C.white, align: 'center', margin: 0, fit: 'shrink',
  });
  addFooter(slide, 2);
  addNotes(slide, `쇼츠 위에 상품명과 가격이 계속 떠 있으면 정보를 바로 볼 수 있지만 영상 내용을 가립니다. 반대로 아무 정보가 없으면 상품을 직접 찾기 어렵습니다. CleanTouch는 정보를 계속 노출하지 않고 사용자가 궁금한 순간에만 상품 검색을 시작하는 방식입니다.`);
}

// 3. Pivot
{
  const slide = pptx.addSlide();
  slide.background = { color: C.paper };
  addTitle(slide, '02 · PIVOT', '플랫폼 중심 SDK에서 사용자 중심 스캔 앱으로', '유튜브·인스타그램의 플레이어를 외부에서 수정할 수 없다는 현실을 반영했습니다.');
  slide.addShape(pptx.ShapeType.roundRect, { x: 0.7, y: 2.1, w: 5.3, h: 3.75, rectRadius: 0.12, fill: { color: C.white }, line: { color: C.line } });
  addPill(slide, '초기 구상', 1.05, 2.47, 1.25, C.violetPale, C.violet);
  slide.addText('영상 속 상품을 직접 터치', { x: 1.05, y: 3.02, w: 4.4, h: 0.45, fontFace: 'Malgun Gothic', fontSize: 19, bold: true, color: C.ink, margin: 0 });
  slide.addText('• 영상 서비스가 SDK를 설치해야 함\n• 상품 위치와 정보를 미리 등록\n• YouTube·Instagram에 바로 적용하기 어려움', { x: 1.08, y: 3.75, w: 4.25, h: 1.45, fontFace: 'Malgun Gothic', fontSize: 11, color: C.gray, margin: 0, breakLine: false, fit: 'shrink' });
  slide.addShape(pptx.ShapeType.chevron, { x: 6.18, y: 3.43, w: 0.95, h: 1.05, fill: { color: C.teal }, line: { color: C.teal } });
  slide.addShape(pptx.ShapeType.roundRect, { x: 7.35, y: 2.1, w: 5.3, h: 3.75, rectRadius: 0.12, fill: { color: C.ink }, line: { color: C.ink } });
  addPill(slide, '현재 구현', 7.7, 2.47, 1.25, C.tealPale, C.tealDark);
  slide.addText('원하는 순간 현재 화면 스캔', { x: 7.7, y: 3.02, w: 4.4, h: 0.45, fontFace: 'Malgun Gothic', fontSize: 19, bold: true, color: C.white, margin: 0 });
  slide.addText('• Android 플로팅 버튼으로 실행\n• 영상 제작자의 사전 등록 불필요\n• 사용자가 상품 위치를 직접 보정 가능', { x: 7.73, y: 3.75, w: 4.25, h: 1.45, fontFace: 'Malgun Gothic', fontSize: 11, color: 'D4E0E3', margin: 0, breakLine: false, fit: 'shrink' });
  addFooter(slide, 3);
  addNotes(slide, `처음에는 딤팩 기술처럼 영상 속 상품을 직접 터치하는 SDK를 생각했습니다. 하지만 외부 회사가 유튜브나 인스타그램 플레이어를 수정할 수 없었습니다. 그래서 플랫폼이 설치해 주기를 기다리는 방식에서 사용자가 직접 현재 화면을 스캔하는 방식으로 바꿨습니다.`);
}

// 4. User flow
{
  const slide = pptx.addSlide();
  slide.background = { color: C.paper };
  addTitle(slide, '03 · EXPERIENCE', '여섯 단계로 끝나는 상품 검색', '영상 시청 흐름을 가능한 한 끊지 않는 것이 핵심입니다.');
  const steps = [
    ['01', '스캔 모드', 'CleanTouch에서 시작'],
    ['02', '전체 화면 공유', 'Android에서 직접 승인'],
    ['03', '영상 시청', 'YouTube·Instagram 이동'],
    ['04', '버튼 선택', '궁금한 순간 한 번'],
    ['05', '상품 분석', '확대 영역으로 AI 검색'],
    ['06', '구매 연결', '쇼핑 검색 결과 이동'],
  ];
  slide.addShape(pptx.ShapeType.line, { x: 1.15, y: 3.25, w: 10.95, h: 0, line: { color: C.line, width: 2 } });
  steps.forEach((step, i) => {
    const x = 0.55 + i * 2.08;
    slide.addShape(pptx.ShapeType.ellipse, { x: x + 0.54, y: 2.71, w: 1.05, h: 1.05, fill: { color: i === 3 ? C.teal : C.ink }, line: { color: C.white, width: 2 } });
    slide.addText(step[0], { x: x + 0.66, y: 3.02, w: 0.8, h: 0.2, fontFace: 'Malgun Gothic', fontSize: 10, bold: true, color: C.white, align: 'center', margin: 0 });
    slide.addText(step[1], { x, y: 4.05, w: 2.13, h: 0.35, fontFace: 'Malgun Gothic', fontSize: 12, bold: true, color: C.ink, align: 'center', margin: 0, fit: 'shrink' });
    slide.addText(step[2], { x, y: 4.58, w: 2.13, h: 0.52, fontFace: 'Malgun Gothic', fontSize: 8.8, color: C.gray, align: 'center', margin: 0, fit: 'shrink' });
  });
  slide.addShape(pptx.ShapeType.roundRect, { x: 2.5, y: 5.7, w: 8.3, h: 0.62, rectRadius: 0.08, fill: { color: C.tealPale }, line: { color: C.tealPale } });
  slide.addText('자동 인식 실패 시  →  작게·보통·넓게 영역을 선택하고 상품 위치를 지정해 재검색', { x: 2.76, y: 5.9, w: 7.78, h: 0.22, fontFace: 'Malgun Gothic', fontSize: 10.5, bold: true, color: C.tealDark, align: 'center', margin: 0, fit: 'shrink' });
  addFooter(slide, 4);
  addNotes(slide, `CleanTouch에서 스캔 모드를 시작하고 Android의 전체 화면 공유를 허용합니다. 평소처럼 영상 앱을 사용하다가 상품이 보일 때 버튼을 누릅니다. 한 화면만 분석하고 쇼핑 검색으로 연결합니다. 상품이 작거나 여러 개면 사용자가 직접 위치를 지정해 다시 검색합니다.`);
}

// 5. Architecture
{
  const slide = pptx.addSlide();
  slide.background = { color: C.paper };
  addTitle(slide, '04 · BUILD', '실제 Android 앱과 검색 서버까지 구현', '웹 화면 시안에서 출발해 다른 앱 위에서 동작하는 네이티브 앱으로 발전했습니다.');
  const blocks = [
    ['영상 앱', 'YouTube · Instagram', C.violetPale, C.violet],
    ['플로팅 버튼', '다른 앱 위에서 실행', C.tealPale, C.tealDark],
    ['화면 한 장', '버튼 순간만 파일 생성', C.mint, C.mintDark],
    ['검색 API', '검증 · 정규화 · AI 분석', 'E8EFF1', C.ink2],
    ['쇼핑 연결', 'Naver · Google', C.warning, C.warningText],
  ];
  blocks.forEach((b, i) => {
    const x = 0.48 + i * 2.58;
    slide.addShape(pptx.ShapeType.roundRect, { x, y: 2.38, w: 2.15, h: 2.05, rectRadius: 0.12, fill: { color: b[2] }, line: { color: b[2] } });
    slide.addText(String(i + 1).padStart(2, '0'), { x: x + 0.22, y: 2.66, w: 0.45, h: 0.25, fontFace: 'Malgun Gothic', fontSize: 8.5, bold: true, color: b[3], margin: 0 });
    slide.addText(b[0], { x: x + 0.22, y: 3.07, w: 1.7, h: 0.36, fontFace: 'Malgun Gothic', fontSize: 14, bold: true, color: C.ink, margin: 0, fit: 'shrink' });
    slide.addText(b[1], { x: x + 0.22, y: 3.65, w: 1.72, h: 0.42, fontFace: 'Malgun Gothic', fontSize: 8.8, color: C.gray, margin: 0, fit: 'shrink' });
    if (i < blocks.length - 1) slide.addShape(pptx.ShapeType.chevron, { x: x + 2.22, y: 3.12, w: 0.28, h: 0.55, fill: { color: C.gray2 }, line: { color: C.gray2 } });
  });
  const features = [
    ['위치 지정', '작은 상품 확대 재검색'],
    ['오류 복구', '일시적 AI 오류 자동 재시도'],
    ['회전 대응', '중복 AI 요청 없이 결과 유지'],
    ['이미지 보호', '임시 파일 삭제·서버 미저장'],
  ];
  features.forEach((f, i) => {
    const x = 0.68 + i * 3.12;
    slide.addShape(pptx.ShapeType.roundRect, { x, y: 5.13, w: 2.75, h: 0.87, rectRadius: 0.09, fill: { color: C.white }, line: { color: C.line } });
    slide.addText(f[0], { x: x + 0.18, y: 5.36, w: 0.92, h: 0.22, fontFace: 'Malgun Gothic', fontSize: 9.2, bold: true, color: C.tealDark, margin: 0 });
    slide.addText(f[1], { x: x + 1.03, y: 5.34, w: 1.54, h: 0.28, fontFace: 'Malgun Gothic', fontSize: 8.2, color: C.gray, margin: 0, fit: 'shrink' });
  });
  addFooter(slide, 5);
  addNotes(slide, `현재 버전은 단순한 화면 시안이 아닙니다. Android MediaProjection, 플로팅 오버레이, 화면 캡처, 검색 API, AI 상품 설명, 쇼핑 검색 링크까지 실제로 연결했습니다. 작은 상품 보정, 회전, 네트워크 오류와 임시 이미지 삭제도 처리했습니다.`);
}

// 6. Demo evidence
{
  const slide = pptx.addSlide();
  slide.background = { color: C.paper };
  addTitle(slide, '05 · RESULT', '작게 보이는 가방도 실제 인식 성공', '전체 화면 중앙의 작은 상품을 스캔한 실제 Android 결과입니다.');
  slide.addShape(pptx.ShapeType.roundRect, { x: 0.65, y: 2.05, w: 2.48, h: 4.55, rectRadius: 0.17, fill: { color: C.ink }, line: { color: C.ink } });
  slide.addImage({ path: productScreen, x: 0.82, y: 2.18, w: 2.14, h: 4.12 });
  slide.addText('입력 화면', { x: 1.33, y: 6.32, w: 1.1, h: 0.2, fontFace: 'Malgun Gothic', fontSize: 8.5, bold: true, color: C.white, align: 'center', margin: 0 });
  slide.addShape(pptx.ShapeType.chevron, { x: 3.47, y: 3.62, w: 0.72, h: 0.85, fill: { color: C.teal }, line: { color: C.teal } });
  slide.addShape(pptx.ShapeType.roundRect, { x: 4.5, y: 2.05, w: 2.48, h: 4.55, rectRadius: 0.17, fill: { color: C.white }, line: { color: C.line } });
  slide.addImage({ path: resultPortrait, x: 4.7, y: 2.18, w: 2.08, h: 4.12 });
  slide.addText('인식 결과', { x: 5.19, y: 6.32, w: 1.1, h: 0.2, fontFace: 'Malgun Gothic', fontSize: 8.5, bold: true, color: C.ink, align: 'center', margin: 0 });
  slide.addShape(pptx.ShapeType.roundRect, { x: 7.48, y: 2.05, w: 5.2, h: 4.55, rectRadius: 0.13, fill: { color: C.white }, line: { color: C.line } });
  addPill(slide, 'LIVE TEST', 7.85, 2.42, 1.2, C.tealPale, C.tealDark);
  slide.addText('검정색 미니 숄더백', { x: 7.85, y: 3.05, w: 4.25, h: 0.55, fontFace: 'Malgun Gothic', fontSize: 22, bold: true, color: C.ink, margin: 0, fit: 'shrink' });
  slide.addText('AI가 색상·형태·카테고리를 분석해\n쇼핑 검색어와 판매처 경로를 생성', { x: 7.87, y: 3.85, w: 4.2, h: 0.85, fontFace: 'Malgun Gothic', fontSize: 11, color: C.gray, margin: 0, fit: 'shrink' });
  const stats = [['2개', '쇼핑 검색 경로'], ['16개', '서버 자동 테스트'], ['0개', 'Android 린트 오류']];
  stats.forEach((s, i) => {
    const x = 7.84 + i * 1.48;
    slide.addText(s[0], { x, y: 5.12, w: 1.25, h: 0.38, fontFace: 'Malgun Gothic', fontSize: 17, bold: true, color: i === 2 ? C.mintDark : C.tealDark, align: 'center', margin: 0 });
    slide.addText(s[1], { x, y: 5.62, w: 1.25, h: 0.45, fontFace: 'Malgun Gothic', fontSize: 7.8, color: C.gray, align: 'center', margin: 0, fit: 'shrink' });
  });
  addFooter(slide, 6);
  addNotes(slide, `실제 휴대전화 화면 중앙에 작게 보이는 검은색 가방을 스캔했습니다. CleanTouch가 검정색 미니 숄더백 계열로 인식했고 네이버 쇼핑과 Google Shopping 경로를 만들었습니다. 서버 자동 테스트 16개와 Android 린트도 통과했습니다.`);
}

// 7. Privacy and quality
{
  const slide = pptx.addSlide();
  slide.background = { color: C.paper };
  addTitle(slide, '06 · TRUST', '버튼을 누른 순간만 처리하고, 실패도 설명한다', '화면 공유 서비스인 만큼 사용자 통제와 오류 안내를 제품 기능으로 다뤘습니다.');
  const items = [
    ['사용자 승인', 'Android 시스템이 전체 화면 공유를 직접 확인', '01'],
    ['한 프레임 처리', '버튼을 누른 순간만 이미지 파일을 생성', '02'],
    ['저장 최소화', '앱 임시 파일 삭제·서버 디스크 미저장', '03'],
    ['안전한 응답', '손상 이미지·잘못된 URL·비정상 AI 응답 차단', '04'],
    ['명확한 한도 안내', '무료 AI 한도 초과를 서버 장애와 구분', '05'],
    ['언제든 종료', '지속 알림에서 스캔 모드를 즉시 중단', '06'],
  ];
  items.forEach((it, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.72 + col * 6.13;
    const y = 2.08 + row * 1.4;
    slide.addShape(pptx.ShapeType.roundRect, { x, y, w: 5.72, h: 1.08, rectRadius: 0.09, fill: { color: C.white }, line: { color: C.line } });
    slide.addShape(pptx.ShapeType.ellipse, { x: x + 0.22, y: y + 0.24, w: 0.58, h: 0.58, fill: { color: row === 2 ? C.violetPale : C.tealPale }, line: { color: row === 2 ? C.violetPale : C.tealPale } });
    slide.addText(it[2], { x: x + 0.27, y: y + 0.43, w: 0.48, h: 0.14, fontFace: 'Malgun Gothic', fontSize: 7.5, bold: true, color: row === 2 ? C.violet : C.tealDark, align: 'center', margin: 0 });
    slide.addText(it[0], { x: x + 1.02, y: y + 0.24, w: 1.55, h: 0.25, fontFace: 'Malgun Gothic', fontSize: 11, bold: true, color: C.ink, margin: 0, fit: 'shrink' });
    slide.addText(it[1], { x: x + 2.55, y: y + 0.23, w: 2.84, h: 0.45, fontFace: 'Malgun Gothic', fontSize: 8.8, color: C.gray, margin: 0, valign: 'mid', fit: 'shrink' });
  });
  slide.addText('주의  |  화면 공유 세션은 스캔 모드 동안 유지되지만, 업로드용 파일은 버튼을 누른 순간에만 생성됩니다.', { x: 1.65, y: 6.35, w: 10.05, h: 0.3, fontFace: 'Malgun Gothic', fontSize: 9, color: C.warningText, bold: true, align: 'center', margin: 0, fit: 'shrink' });
  addFooter(slide, 7);
  addNotes(slide, `화면 공유 세션은 스캔 모드 동안 유지되지만 실제 파일 생성과 업로드는 사용자가 버튼을 누른 순간에만 수행합니다. 임시 파일은 삭제하고 서버도 이미지를 디스크에 저장하지 않습니다. 한도 초과나 외부 서비스 오류도 사용자에게 구분해 안내합니다.`);
}

// 8. Differentiation
{
  const slide = pptx.addSlide();
  slide.background = { color: C.paper };
  addTitle(slide, '07 · DIFFERENCE', '기술보다 중요한 차이는 “영상 안에서의 흐름”', '검색 정확도뿐 아니라 사용자가 영상을 떠나지 않는 경험을 설계합니다.');
  const headers = ['비교 항목', '고정 상품 스티커', '일반 이미지 검색', 'CleanTouch'];
  const xs = [0.65, 3.05, 6.22, 9.35];
  const ws = [2.35, 3.1, 3.05, 3.28];
  headers.forEach((h, i) => {
    slide.addShape(pptx.ShapeType.roundRect, { x: xs[i], y: 2.05, w: ws[i], h: 0.62, rectRadius: 0.06, fill: { color: i === 3 ? C.ink : 'E8EFF1' }, line: { color: i === 3 ? C.ink : 'E8EFF1' } });
    slide.addText(h, { x: xs[i] + 0.08, y: 2.26, w: ws[i] - 0.16, h: 0.2, fontFace: 'Malgun Gothic', fontSize: 9.5, bold: true, color: i === 3 ? C.white : C.ink, align: 'center', margin: 0, fit: 'shrink' });
  });
  const rows = [
    ['영상 가림', '계속 가릴 수 있음', '가리지 않음', '가리지 않음'],
    ['검색 시작', '자동 노출', '스크린샷·앱 이동', '플로팅 버튼 한 번'],
    ['사전 상품 등록', '필요', '불필요', '불필요'],
    ['작은 상품 보정', '등록 위치 의존', '이미지 확대 필요', '앱 안에서 위치 지정'],
    ['구매 연결', '미리 연결한 상품', '일반 검색 결과', '영상 순간의 검색 결과'],
  ];
  rows.forEach((r, ri) => {
    const y = 2.83 + ri * 0.69;
    r.forEach((txt, ci) => {
      slide.addShape(pptx.ShapeType.rect, { x: xs[ci], y, w: ws[ci], h: 0.58, fill: { color: ci === 3 ? (ri % 2 ? 'EDF9FB' : C.white) : (ri % 2 ? 'F6F8F9' : C.white) }, line: { color: C.line, width: 0.6 } });
      slide.addText(txt, { x: xs[ci] + 0.1, y: y + 0.18, w: ws[ci] - 0.2, h: 0.2, fontFace: 'Malgun Gothic', fontSize: ci === 0 ? 9 : 8.8, bold: ci === 0 || ci === 3, color: ci === 3 ? C.tealDark : C.gray, align: ci === 0 ? 'left' : 'center', margin: 0, fit: 'shrink' });
    });
  });
  slide.addShape(pptx.ShapeType.roundRect, { x: 2.25, y: 6.45, w: 8.8, h: 0.45, rectRadius: 0.07, fill: { color: C.tealPale }, line: { color: C.tealPale } });
  slide.addText('CleanTouch의 차별점: 이미지 검색 기술 자체보다 영상 시청 중 바로 사용하는 연결 방식', { x: 2.48, y: 6.58, w: 8.34, h: 0.18, fontFace: 'Malgun Gothic', fontSize: 9.5, bold: true, color: C.tealDark, align: 'center', margin: 0, fit: 'shrink' });
  addFooter(slide, 8);
  addNotes(slide, `Google Lens 같은 이미지 검색 서비스도 있습니다. CleanTouch의 차이는 검색 기술을 새로 발명했다는 데 있지 않습니다. 영상 중 스크린샷 저장, 앱 이동, 이미지 불러오기 과정을 줄이고 정보를 계속 띄우지 않는 사용 흐름이 핵심입니다.`);
}

// 9. Business
{
  const slide = pptx.addSlide();
  slide.background = { color: C.paper };
  addTitle(slide, '08 · BUSINESS', '사용자는 무료, 커머스 사업자가 비용을 낸다', '초기 가격은 검증 전 가정이며 고객 인터뷰와 실증으로 수정해야 합니다.');
  addCard(slide, 0.68, 2.12, 3.75, 3.65, '돈을 내는 고객', '자체 숏폼 피드를 운영하는 쇼핑몰·홈쇼핑\n숏폼 플레이어를 공급하는 영상 솔루션 회사\n패션 브랜드와 상품 데이터를 가진 사업자', C.teal);
  addCard(slide, 4.8, 2.12, 3.75, 3.65, '제공하는 가치', '영상 몰입도를 해치지 않는 상품 연결\n상품 클릭·구매 도달 분석\n상품 DB와 영상 검색 데이터 연동', C.violet);
  addCard(slide, 8.92, 2.12, 3.75, 3.65, '수익 모델', '기업용 SDK·관리 화면 라이선스\n상품 DB 연동 및 분석 기능 이용료\n검색 노출·제휴 구매 수수료', C.mintDark);
  slide.addShape(pptx.ShapeType.roundRect, { x: 1.5, y: 6.12, w: 10.35, h: 0.6, rectRadius: 0.08, fill: { color: C.ink }, line: { color: C.ink } });
  slide.addText('초기 가정  |  고객사당 연 2,400만 원 + 구매액 2%  →  첫 실증에서 지불 의사 검증', { x: 1.78, y: 6.31, w: 9.78, h: 0.22, fontFace: 'Malgun Gothic', fontSize: 10.5, bold: true, color: C.white, align: 'center', margin: 0, fit: 'shrink' });
  addFooter(slide, 9);
  addNotes(slide, `일반 사용자는 무료로 사용하고 쇼핑몰, 브랜드, 숏폼 커머스 사업자가 비용을 내는 구조입니다. 기업용 라이선스, 상품 DB 연동, 분석 기능, 제휴 수수료를 생각하고 있습니다. 연 2,400만 원과 구매액 2퍼센트는 확정 가격이 아니라 고객 인터뷰로 검증할 가정입니다.`);
}

// 10. Limitations
{
  const slide = pptx.addSlide();
  slide.background = { color: C.paper };
  addTitle(slide, '09 · REALITY CHECK', '현재 동작하는 것과 아직 필요한 것을 구분', '기술 시제품은 완성됐지만 다수 사용자를 받는 운영 서비스는 다음 단계입니다.');
  slide.addShape(pptx.ShapeType.roundRect, { x: 0.7, y: 2.05, w: 5.85, h: 4.25, rectRadius: 0.12, fill: { color: C.white }, line: { color: C.line } });
  addPill(slide, 'NOW · 구현 완료', 1.05, 2.42, 1.65, C.mint, C.mintDark);
  slide.addText('• Android 실제 화면 캡처와 플로팅 버튼\n• 작은 상품 위치 지정과 확대 검색\n• AI 상품 특징 분석과 쇼핑 검색 연결\n• 오류·회전·이미지 정리 대응\n• 빌드·린트·서버 자동 테스트 통과', { x: 1.08, y: 3.14, w: 4.85, h: 2.4, fontFace: 'Malgun Gothic', fontSize: 12, color: C.ink2, margin: 0, breakLine: false, fit: 'shrink', paraSpaceAfterPt: 9 });
  slide.addShape(pptx.ShapeType.roundRect, { x: 6.8, y: 2.05, w: 5.85, h: 4.25, rectRadius: 0.12, fill: { color: C.ink }, line: { color: C.ink } });
  addPill(slide, 'NEXT · 사업화 필요', 7.15, 2.42, 1.75, C.warning, C.warningText);
  slide.addText('• HTTPS 클라우드 검색 서버와 사용자 인증\n• 충분한 AI 사용량과 운영 모니터링\n• 정확한 가격·재고를 위한 제휴 상품 DB\n• iPhone용 스크린샷 공유 방식\n• Google Play 화면 공유·오버레이 심사', { x: 7.18, y: 3.14, w: 4.85, h: 2.4, fontFace: 'Malgun Gothic', fontSize: 12, color: 'DCE6E8', margin: 0, breakLine: false, fit: 'shrink', paraSpaceAfterPt: 9 });
  addFooter(slide, 10);
  addNotes(slide, `현재 버전은 실제 동작하는 기술 시제품입니다. 다만 무료 AI와 로컬 서버를 사용하므로 많은 사용자를 받을 수는 없습니다. 정확한 동일 상품과 가격을 제공하려면 제휴 카탈로그와 이미지 검색이 필요하고, iPhone과 스토어 정책도 별도로 해결해야 합니다.`);
}

// 11. Roadmap
{
  const slide = pptx.addSlide();
  slide.background = { color: C.darkBg };
  slide.addShape(pptx.ShapeType.ellipse, { x: 9.65, y: -1.6, w: 5.4, h: 5.4, fill: { color: C.teal, transparency: 84 }, line: { color: C.teal, transparency: 100 } });
  slide.addShape(pptx.ShapeType.ellipse, { x: -1.8, y: 5.3, w: 4.3, h: 4.3, fill: { color: C.violet, transparency: 84 }, line: { color: C.violet, transparency: 100 } });
  slide.addText('NEXT STEP', { x: 0.7, y: 0.55, w: 2.2, h: 0.25, fontFace: 'Malgun Gothic', fontSize: 8.5, bold: true, charSpacing: 1.6, color: C.teal, margin: 0 });
  slide.addText('정확도를 증명하고,\n첫 상품 DB 파트너로 연결', { x: 0.68, y: 1.05, w: 7.8, h: 1.35, fontFace: 'Malgun Gothic', fontSize: 30, bold: true, color: C.white, margin: 0, fit: 'shrink' });
  const roadmap = [
    ['01', '가방 카테고리 집중', '형태가 분명한 상품부터 검색 정확도 측정'],
    ['02', '실제 쇼츠 50개', '크기·위치별 성공률과 검색 시간 기록'],
    ['03', '사용자 20~50명', '완주율·클릭률·구매 페이지 도달률 비교'],
    ['04', '클라우드·상품 DB', 'HTTPS 운영 서버와 첫 커머스 파트너 연결'],
  ];
  roadmap.forEach((r, i) => {
    const x = 0.72 + i * 3.05;
    slide.addShape(pptx.ShapeType.roundRect, { x, y: 3.1, w: 2.65, h: 2.25, rectRadius: 0.12, fill: { color: i === 3 ? C.teal : '142B33', transparency: i === 3 ? 0 : 3 }, line: { color: i === 3 ? C.teal : '35515B', width: 1 } });
    slide.addText(r[0], { x: x + 0.22, y: 3.37, w: 0.5, h: 0.25, fontFace: 'Malgun Gothic', fontSize: 9, bold: true, color: i === 3 ? C.ink : C.teal, margin: 0 });
    slide.addText(r[1], { x: x + 0.22, y: 3.88, w: 2.15, h: 0.5, fontFace: 'Malgun Gothic', fontSize: 14, bold: true, color: i === 3 ? C.ink : C.white, margin: 0, fit: 'shrink' });
    slide.addText(r[2], { x: x + 0.22, y: 4.57, w: 2.12, h: 0.5, fontFace: 'Malgun Gothic', fontSize: 8.5, color: i === 3 ? C.ink2 : 'C8D7DA', margin: 0, fit: 'shrink' });
  });
  slide.addText('“상품 정보를 더 많이 보여주는 것이 아니라, 사용자가 원하는 순간에만 자연스럽게 연결한다.”', { x: 1.1, y: 6.2, w: 11.1, h: 0.42, fontFace: 'Malgun Gothic', fontSize: 13, italic: true, color: 'D7E5E7', align: 'center', margin: 0, fit: 'shrink' });
  addFooter(slide, 11, true);
  addNotes(slide, `다음 단계에서는 모든 상품을 한 번에 지원하기보다 가방 카테고리부터 정확도를 측정하겠습니다. 실제 쇼츠 50개와 사용자 20명 이상을 대상으로 완주율과 클릭률을 검증한 뒤 HTTPS 서버와 첫 상품 DB 파트너로 발전시키겠습니다. CleanTouch의 핵심은 정보를 더 많이 보여주는 것이 아니라 원하는 순간에만 자연스럽게 연결하는 것입니다.`);
}

pptx.writeFile({ fileName: path.resolve('presentation/CleanTouch_프로젝트_발표자료.pptx') });
