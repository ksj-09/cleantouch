const PptxGenJS=require('pptxgenjs');
const path=require('node:path');
const fs=require('node:fs');
const pptx=new PptxGenJS();
pptx.layout='LAYOUT_WIDE';
pptx.author='CleanTouch';pptx.title='CleanTouch 서비스 기획서';pptx.subject='기획·구현 현황·개선 우선순위';pptx.lang='ko-KR';
pptx.theme={headFontFace:'맑은 고딕',bodyFontFace:'맑은 고딕',lang:'ko-KR'};
const C={bg:'F5F7FA',ink:'152B33',muted:'63757D',mint:'73DFC1',teal:'157D70',light:'E1F5EE',white:'FFFFFF',line:'D8E2E7',navy:'10242D',amber:'9D6617',amberBg:'FFF1D8'};
const outline=[];
function text(s,t,x,y,w,h,size=18,opt={}){s.addText(t,{x,y,w,h,fontFace:'맑은 고딕',fontSize:size,color:C.ink,margin:0,breakLine:false,paraSpaceAfterPt:8,...opt});}
function shape(s,x,y,w,h,fill=C.white,line=fill){s.addShape(pptx.ShapeType.roundRect,{x,y,w,h,rectRadius:.12,fill:{color:fill},line:{color:line,radius:.12}});}
function slide(title,sub,section){const s=pptx.addSlide();s.background={color:C.bg};const n=pptx._slides.length;const cover=n===1;
 text(s,'CLEANTOUCH  /  SERVICE PLAN',.6,.3,7,.22,10,{color:C.teal,bold:true,charSpacing:1.5});
 text(s,section,10,.3,2.7,.25,10,{color:C.muted,align:'right'});
 text(s,title,.6,.84,12.1,.68,29,{bold:true,color:cover?C.white:C.ink});text(s,sub,.62,1.65,12,.45,13,{color:cover?'CADBD7':C.muted});
 s.addShape(pptx.ShapeType.line,{x:.6,y:7.05,w:12.1,h:0,line:{color:C.line,width:1}});
 text(s,'기획서 + 구현 현황 기준  |  2026.10.06',.6,7.16,9,.18,9,{color:C.muted});text(s,String(n).padStart(2,'0'),12.2,7.12,.5,.25,10,{color:C.teal,align:'right',bold:true});
 outline.push({title,sub,items:[]});return s;
}
function note(s,body,source){s.addNotes(`${body}\n근거: ${source}`);outline.at(-1).items.push(body);}
function card(s,x,y,w,h,head,body,{fill=C.white,headColor=C.teal,size=17}={}){shape(s,x,y,w,h,fill);text(s,head,x+.25,y+.24,w-.5,.48,19,{bold:true,color:headColor});text(s,body,x+.25,y+.97,w-.5,h-1.15,size,{color:C.ink});outline.at(-1).items.push(`${head}: ${body}`);}
function banner(s,t,y=6.32){shape(s,.6,y,12.1,.45,C.light);text(s,t,.83,y+.09,11.6,.26,12,{bold:true,color:C.teal});}
// 01
{
 const s=slide('CleanTouch 서비스 기획서','영상 속 상품을 발견하는 순간부터, 비슷한 상품과 구매처를 찾기까지','PROJECT OVERVIEW');
 s.background={color:C.navy};
 text(s,'보고 있던 영상에서\n마음에 드는 상품을 바로 찾다',.72,2.46,9.3,1.55,35,{color:C.white,bold:true});
 text(s,'작은 위젯  →  상품 선택  →  AI 인식  →  이미지 검색·구매처 연결',.75,4.38,11.8,.7,20,{color:C.mint});
 text(s,'Android 모바일 우선 · Windows PC 지원',.75,5.58,10,.35,17,{color:'CADBD7'});
 text(s,'현재 기준  Windows 0.1.23  /  Android 0.4.5',.75,6.19,11,.35,14,{color:'CADBD7'});
 note(s,'일반 사용자가 API 키 발급이나 분석 서버 설정 없이 이용하는 것이 제품 방향이다. 현재 구매 연결은 Lens 이미지 검색이며 직접 결제 기능은 없다.','메모장 CleanTouch-간단기획서-20261001.txt, desktop/package.json, Android app/build.gradle.kts');
}
// 02
{
 const s=slide('목차','서비스의 목적, 사용 방법, 구현 상태와 다음 작업을 순서대로 설명합니다.','CONTENTS');
 const rows=[['01','서비스 목표와 사용자','영상 시청 흐름을 유지하는 상품 탐색'],['02','사용 흐름과 핵심 기능','모바일 위젯 · 현재 화면 · 모두 분석'],['03','AI 인식과 구매 연결','상품 윤곽 · 짧은 이름 · Lens 검색'],['04','구현 현황과 검증','PC 개선 결과 · 모바일 확인 범위'],['05','남은 과제와 우선순위','안정성 → 정확도 → 구매 편의']];
 rows.forEach((r,i)=>{const y=2.27+i*.78;shape(s,.62,y,12.05,.65,C.white);text(s,r[0],.87,y+.14,.6,.35,18,{bold:true,color:C.teal});text(s,r[1],1.66,y+.15,4.2,.3,17,{bold:true});text(s,r[2],6.18,y+.17,6,.29,14,{color:C.muted});});
 note(s,'표지와 목차를 포함해 총 12장. 구현된 기능과 목표 기능을 구분한다.','본 기획서 구성');
}
// 03
{
 const s=slide('서비스 목표와 사용자','검색어를 고민하거나 이미지를 직접 저장하는 수고를 줄입니다.','01  SERVICE');
 card(s,.6,2.35,5.9,3.6,'사용자와 상황','유튜브·인스타그램 영상을 보는 일반 사용자\n\n옷, 가방, 신발, 장난감 등\n영상 속 마음에 드는 상품을 발견한 순간');
 card(s,6.78,2.35,5.9,3.6,'제공하려는 경험','시청 중 작은 위젯으로 상품 선택\n\n상품 사진과 핵심 키워드 확인\n비슷한 제품과 판매처 탐색');
 banner(s,'설치 후 권한을 허용하면 시작 · 일반 사용자에게 API 키나 분석 서버 설정을 요구하지 않음');
 note(s,'발견·선택·확인은 시청 화면에서 진행하고 외부 이미지 검색 및 판매 사이트 이동 시 다른 화면으로 전환된다. 판매처 탐색을 돕는 서비스이며 동일 상품 식별을 항상 보장하지 않는다.','메모장 목표·사용자·사용 흐름');
}
// 04
{
 const s=slide('모바일 사용 흐름','영상 시청 중 필요한 순간에만 위젯을 펼칩니다.','02  USER FLOW');
 const stages=[['1','앱 실행·스캔 시작','원형 시작 버튼\n화면 공유·위젯 권한 허용'],['2','영상 시청','유튜브·인스타그램으로 이동\n작은 위젯은 화면에 유지'],['3','원하는 상품 선택','위젯 → 현재 화면 상품 찾기\n옷·가방·장난감 등을 터치'],['4','인식 결과 확인','상품 영역·윤곽 표시\n잘못 잡혔으면 다시 선택'],['5','비슷한 상품 탐색','선택한 사진을 Lens로 전달\n검색 결과에서 판매처 이동']];
 stages.forEach((r,i)=>{const x=.6+i*2.46;shape(s,x,2.52,2.24,3.05,C.white);shape(s,x+.2,2.75,.48,.48,C.light);text(s,r[0],x+.2,2.84,.48,.25,16,{bold:true,color:C.teal,align:'center'});text(s,r[1],x+.2,3.48,1.88,.75,15,{bold:true});text(s,r[2],x+.2,4.42,1.86,.86,13,{color:C.muted});if(i<4)text(s,'›',x+2.27,3.67,.2,.4,23,{color:C.teal});});
 banner(s,'이미지 저장·수동 업로드 없이 선택한 상품 사진을 검색으로 전달하는 흐름');
 note(s,'이 슬라이드는 목표 사용 흐름이며 실제 모바일 윤곽 인식과 스캔 유지 안정성에는 개선이 필요하다. 원형 시작 버튼 및 권한 요청의 기획 의도를 반영했다.','메모장 사용 흐름(모바일), FloatingScanService.kt');
}
// 05
{
 const s=slide('위젯은 지금의 상품, 큰 화면은 지금까지의 상품','현재 화면 분석과 모두 분석의 역할을 분명하게 나눕니다.','02  CORE FEATURES');
 card(s,.6,2.35,5.9,3.75,'현재 화면 상품 찾기','시청 중 위젯에서 실행\n원하는 상품을 한 번 터치·클릭\n선택한 상품의 영역과 윤곽 확인\n상품 부분만 이미지 검색으로 전달');
 card(s,6.78,2.35,5.9,3.75,'모두 분석·큰 화면 보기','스캔을 일시정지하고 모은 장면 분석\n이미 지나간 상품도 목록에서 확인\n사진·등장 시점·저장 장면 보기\n확인 후 스캔 계속하기');
 banner(s,'위젯은 이동·축소·숨김으로 시청 방해 최소화 · 같은 상품의 반복 등장은 하나로 모음');
 note(s,'모두 분석은 영상 전체를 나중에 다운로드해 분석하는 방식이 아니라 해당 스캔 세션에서 수집한 장면을 대상으로 한다. 표본 사이에 짧게 나타난 상품은 놓칠 수 있다.','메모장 핵심 기능, renderer.js analyzeAllScenes, Android MainActivity.kt');
}
// 06
{
 const s=slide('AI가 상품을 찾고, 사람은 선택 결과를 확인','사각형 영역보다 상품의 실제 윤곽을 잡는 것이 핵심 개선 목표입니다.','03  AI RECOGNITION');
 const blocks=[['상품 후보 탐지','장면에서 상품으로 보이는 영역을 찾음'],['선택·윤곽 추출','터치 위치의 상품을 잡고 배경을 제외'],['간단한 이름 생성','청바지 · 가방 · 보라색 광선검'],['반복 상품 통합','상품명·이미지·위치를 비교해 중복 제거']];
 blocks.forEach((r,i)=>card(s,.6+(i%2)*6.18,2.3+Math.floor(i/2)*1.82,5.9,1.61,r[0],r[1],{size:15}));
 banner(s,'상품 후보 탐지·분류·윤곽 처리는 기기 내 AI · 불확실한 분류는 “AI 추정”으로 표시');
 note(s,'현재 AI는 범위가 정해진 로컬 인식 모델이다. 작은 물체, 가려진 상품, 지원이 약한 종류의 정확도는 남은 과제다. 밝은 광선검 후보 보완과 로컬 분류 검증을 PC에 추가했다. 윤곽 표시가 모든 상품에서 완성됐다고 주장하지 않는다.','ai-label-worker.js, renderer.js, glow-regions.js, Android PointObjectMasker.kt, 간단기획서 우선 개선 사항');
}
// 07
{
 const s=slide('구매 연결: 현재는 Lens, 다음은 판매처 바로가기','이름만 검색해서 다른 상품이 나오는 문제를 이미지 중심으로 개선합니다.','03  PURCHASE');
 card(s,.6,2.35,5.9,3.52,'현재 구현된 연결','선택한 상품 사진 → Google Lens\n\n비슷한 이미지·상품 결과 확인\n검색 결과에서 판매 사이트로 이동\nLens와 판매 사이트에는 인터넷 필요');
 card(s,6.78,2.35,5.9,3.52,'다음 개선 방향','판매처로 바로가기 흐름 단축\n\n사용자의 저장·업로드 작업 최소화\n정보 확인부터 구매처 이동까지 간소화\n동일·유사 상품을 명확하게 구분',{fill:C.amberBg,headColor:C.amber});
 banner(s,'현재는 구매를 돕는 검색 연결 · 앱 안에서 자동 결제하는 기능은 구현 범위에 없음');
 note(s,'사용자가 지적한 예시는 보라색 광선검이 LED 형광판으로 검색되는 문제다. 이미지 기반 검색으로 개선했으나 동일 상품 매칭과 구매 직행을 보장하지 않는다. 메모장의 판매사이트 직접 이동은 계획으로 표시했다.','메모장 구매 연결·사용 흐름, main.cjs visual:search, Android LensSearchActivity.kt');
}
// 08
{
 const s=slide('장면 수집과 영상 등장 시간','스캔을 켠 뒤 흐른 시간과 실제 영상의 재생 시간을 구분합니다.','03  SCENES & TIME');
 card(s,.6,2.35,5.9,3.65,'장면 수집','현재: 일정 간격의 화면 장면을 수집\n전체 영상·소리를 녹화 파일로 저장하지 않음\n모두 분석은 수집된 장면까지만 분석\n\n계획: 연속 스캔으로 짧은 등장도 포착',{size:16});
 card(s,6.78,2.35,5.9,3.65,'시간과 영상 변경','재생 시간·일시정지·이동 표시를 읽어 보정\n확인되지 않는 시간은 “시청 추정” 표시\n영상 변경 시 구분하고 이전 기록 유지\n\n쇼츠·되감기·앱별 동작은 추가 검증',{size:16});
 banner(s,'상품 목록에는 사진 + 영상별 등장 시점 + 반복 등장 기록을 함께 제공');
 note(s,'PC 화면 OCR과 Windows 미디어 세션 및 YouTube 화면 정보, Android 기기 내 OCR·타임라인 로직이 구현됐다. 실제 테스트 영상은 일시정지 상태에서 추정 0:00이 표시됐으므로 모든 영상의 정확한 시간 추적이 검증됐다고 표현하지 않는다. 현재 PC 수집 간격은 약 5초다.','renderer.js, windows-media-time.ps1, windows-video-region.ps1, watch-timeline.js, Android WatchTimeline.kt, ScreenPlaybackObserver.kt');
}
// 09
{
 const s=slide('PC 0.1.23: 실제 쇼츠 화면으로 개선 결과 확인','설치형·포터블 제공 · 사용자 PC에 0.1.23 설치 및 실제 분석 검증','04  WINDOWS');
 const screenshot=path.resolve('presentation/assets/pc-results-0123.png');
 shape(s,.6,2.32,7.42,3.7,C.white);s.addImage({path:screenshot,x:.8,y:3.04,w:7.02,h:7.02*400/1260});
 text(s,'실제 설치 앱의 상품 결과 화면',.85,6.07,7,.3,11,{color:C.muted});
 card(s,8.28,2.32,4.41,3.9,'확인된 개선','영상 영역만 분석\n다른 창에 가려진 장면 수집 중단\n위젯을 영상 바깥쪽에 배치\n간단한 상품명과 좁은 상품 사진\n겹친 후보·반복 장면 통합',{size:15});
 banner(s,'실제 확인: “보라색 광선검” 1항목 + 3장면 기록 · 로컬 분석 · 핵심 단위 검사 13개 통과');
 note(s,'실제 유튜브 쇼츠 aAL9CokLGlI를 모니터에서 수집하고 설치된 앱에서 모두 분석했다. 결과는 광선검 1항목, 자동차 1항목이며 각각 3장면 기록이다. 브라우저 UI가 마우스·노트북으로 잘못 분석되는 것을 막았다. 이 사례는 전체 상품에 대한 성능 수치가 아니다. 화면 캡처 차단은 사용자 요청으로 해제했다.','artifacts/verification/live-screen-results.json, cleantouch-current-window.png, scene-capture.test.cjs 및 이전 검증 기록');
}
// 10
{
 const s=slide('Android 0.4.5: 기본 기능 구현, 실기기 안정화가 우선','모바일 중심의 제품 방향은 유지하되 PC와 동일한 완성도로 검증해야 합니다.','04  ANDROID');
 card(s,.6,2.35,5.9,3.6,'구현된 기반','원형 시작 화면·화면 공유 권한\n이동·축소·숨김이 가능한 위젯\n상품 터치 선택·마킹·Lens 연결\n수집 장면의 모두 분석·상품 목록\n기기 내 AI·영상 시간 추적 로직',{size:16});
 card(s,6.78,2.35,5.9,3.6,'확인이 필요한 부분','갤럭시 A15의 분석 중 종료 증상\n실제 상품 윤곽 인식 정확도\n선택 취소·실패 후 위젯 복원\n메모리 부담·반응 속도\n앱 전환과 Lens 복귀 흐름',{fill:C.amberBg,headColor:C.amber,size:16});
 banner(s,'캡처 버퍼·예외 처리·메모리 개선 및 에뮬레이터 검증 완료 · A15 실기기 문제 해결 확정은 아님');
 note(s,'0.4.3에서 버퍼 마지막 행·패딩 처리, 캡처 실패 복구, 시간 초과 시 위젯 복원, 해상도 상한 및 회전 복구를 보완했고 19개 단위 검사와 에뮬레이터 선택·취소·Lens 연결을 검증했다. 0.4.5가 현재 소스 버전이며 최신 PC 0.1.23 개선을 모바일에도 적용했다고 주장하지 않는다. 사용자가 메모장에 모바일 종료 버그를 남은 과제로 명시했다.','Android app/build.gradle.kts, MOBILE-0.4.3-NOTES.md, MainActivity.kt, FloatingScanService.kt, 메모장');
}
// 11
{
 const s=slide('현재 구현과 남은 작업을 한눈에','구현 여부와 검증 범위를 구분해 이후 개발 기준으로 사용합니다.','04  STATUS');
 const rows=[
 ['설치·시작·위젯','PC·Android 구현','모바일 대비·크기·반응 속도 개선'],
 ['현재 화면 상품 선택','선택·영역 추출·Lens 전달 구현','상품 윤곽의 정확도와 실기기 안정성'],
 ['모두 분석·상품 목록','수집 장면 분석·등장 기록 구현','탐지 범위와 중복 제거 일반화'],
 ['영상 등장 시간','실제 시간 보정 + 추정 표시 구현','쇼츠·일시정지·되감기 범위 검증'],
 ['이미지로 구매처 찾기','Google Lens 연결 구현','판매 사이트로 더 짧게 이동'],
 ['연속 화면 스캔','현재는 간격별 장면 수집','성능·메모리를 고려해 연속 수집 설계']];
 const x=[.62,3.53,7.81],w=[2.75,4.12,4.86];
 ['기능','현재 상태','남은 과제'].forEach((t,i)=>{shape(s,x[i],2.3,w[i],.49,C.navy);text(s,t,x[i]+.15,2.42,w[i]-.3,.25,14,{color:C.white,bold:true});});
 rows.forEach((r,j)=>r.forEach((t,i)=>{const y=2.9+j*.49;shape(s,x[i],y,w[i],.43,j%2?C.light:C.white);text(s,t,x[i]+.13,y+.09,w[i]-.26,.3,i===0?13:11.5,{bold:i===0,color:i===2?C.muted:C.ink});}));
 banner(s,'목표 기능이 있다는 것과 모든 기기에서 안정적으로 검증됐다는 것은 구분');
 note(s,'이미지 인식은 기기 안에서 실행되며 기존 API·서버 연동 코드는 일반 사용자 사용 흐름의 필수 조건이 아니다. 본 표는 목표와 현재 구현을 구분하는 실행 기준이다.','메모장, 최신 PC 실제 검증, Android 구현·검증 기록');
}
// 12
{
 const s=slide('다음 작업: 모바일 안정성부터 구매 편의까지','기획서의 우선순위를 유지하고, 각 단계의 확인 기준을 명확히 합니다.','05  NEXT STEPS');
 const rows=[['01','모바일 분석 중 종료 해결','A15에서 선택·취소·재선택 후 스캔과 위젯 유지'],['02','상품 윤곽 인식 개선','옷·가방·신발·장난감을 선택했을 때 배경 포함 최소화'],['03','모두 분석 정확도 개선','같은 상품은 통합하고 다른 상품은 구분 · 누락 감소'],['04','위젯 사용 편의 개선','작은 버튼·명확한 글자·빠른 반응 · 앱 전환 정상 동작']];
 rows.forEach((r,i)=>{const y=2.31+i*.78;shape(s,.6,y,12.1,.65,C.white);text(s,r[0],.85,y+.14,.55,.3,18,{color:C.teal,bold:true});text(s,r[1],1.65,y+.15,4.12,.3,16,{bold:true});text(s,r[2],5.8,y+.17,6.5,.32,12,{color:C.muted});});
 shape(s,.6,5.7,12.1,.94,C.navy);text(s,'후속 확장',.86,5.91,2,.32,16,{color:C.mint,bold:true});text(s,'판매처 바로가기 · 연속 스캔 · 쇼츠와 재생 이동 인식 확대',3.03,5.92,9.2,.42,17,{color:C.white});
 note(s,'새 기능을 늘리기 전에 모바일 종료 문제와 현재 화면 선택의 정확도를 우선 해결한다. 연속 스캔과 판매처 직접 이동은 기획 중인 후속 확장으로 별도 표기하며 일정·성능 목표를 임의로 약속하지 않는다.','메모장 우선 개선 사항 및 구현 내용의 계획 항목');
}
fs.writeFileSync(path.resolve('presentation/CleanTouch_기획서_작업정리_20261006.md'),`# CleanTouch 기획서·작업 정리\n\n기준일: 2026-10-06. 열려 있던 메모장의 저장된 간단기획서와 현재 소스·검증 기록을 반영했습니다.\n\n`+outline.map((s,i)=>`## ${i+1}. ${s.title}\n\n${s.sub}\n\n${s.items.join('\n\n')}\n`).join('\n'),'utf8');
pptx.writeFile({fileName:path.resolve('presentation/CleanTouch_기획서_20261006.pptx')});
