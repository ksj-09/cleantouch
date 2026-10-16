# CleanTouch 집 PC 작업 인수인계

기준일: 2026-10-16. 이 문서를 최신 기준으로 읽습니다. 예전 HANDOFF.md와 TRANSFER-HANDOFF.md의 버전·미완료 목록은 당시 기록입니다.

## 목적과 사용자 요구

영상을 보다가 떠 있는 작은 아이콘을 눌러 상품을 선택하고, AI와 대화하며 실제로 비슷한 상품의 판매 페이지까지 찾는 서비스입니다. Windows, Android를 지원하며 모바일 사용자가 특히 중요합니다. 소비자에게 API 키 발급이나 서버 주소 입력을 요구하지 않습니다. 단순 키워드 검색을 동일 상품 구매 링크처럼 표시하지 않습니다. 광선검뿐 아니라 모든 상품을 대상으로 하며 특정 상품 사전으로 제한하지 않습니다.

아이콘은 자유롭게 드래그하고 접기/펼치기 위치를 유지해야 합니다. 화면·마이크는 사용자가 허용할 때만 공유합니다. 사진 없는 채팅, 업로드, 대화 사이드바·기억, 음성 대화, 화면과 함께 대화, 상품 선택 윤곽, 지난 장면 전체 분석을 지원합니다. 모두 분석은 수집을 일시정지한 뒤 고정된 장면 목록을 처리하고 재개할 수 있어야 합니다. 일시정지한 영상의 동일 프레임을 반복 분석해 비용을 낭비하지 않아야 합니다. 가로 전체화면 영상도 중요합니다.

## 저장소와 구조

- GitHub: https://github.com/ksj-09/cleantouch
- 브랜치: feature/cleantouch-visual-search
- 저장소 루트 아래 cleantouch-project/에 CleanTouch 전용 소스를 모았습니다. 이전 커밋의 루트 cleantouch-* 경로와 혼동하지 마세요.
- cleantouch-desktop/: Electron Windows 앱, main.cjs/preload.cjs/renderer.js, place-chat.js, voice-chat.js, scene-capture.js, scene-dedup.js, shopping-cards.js.
- cleantouch-search-api/: TypeScript API, Express 로컬 서버, Netlify 함수, Gemini 및 판매처 검증, DB 사용량 원장.
- cleantouch-android/: Kotlin Android 네이티브 앱. 최근 PC 수정이 전부 반영·재빌드된 것은 아닙니다.
- cleantouch/: React 웹 프로토타입·SDK. presentation/: PPT·PDF와 생성 스크립트. scripts/: 빌드·검증 도구.
- .local/, artifacts/, node_modules/, .netlify/, 앱 사용자 데이터는 Git에 포함하지 않습니다.

## 최신 구현: Windows 0.1.64

1. 원래 영상 장면과 선택 상품 사진을 함께 참고하여 분류합니다. 사진 대화의 후속 질문과 저장/복원에도 원본 장면 근거 1장을 제한 크기로 유지합니다. 새 사진에는 이전 장면을 섞지 않습니다. 음성 사진 질문은 아직 이 근거 전달 범위가 다릅니다.
2. 판매처 후보마다 URL 기반 sourceId를 사용해 다른 색상 상품 링크와 바뀌는 오류를 수정했습니다. 상품 상세 페이지 사진을 다시 대조하며, 식별자가 보이지 않으면 동일 SKU라고 단정하지 않습니다. 키워드 검색은 검증된 판매 후보와 분리합니다.
3. 설치별 Ed25519 서명을 요청 본문에 연결했습니다. 개인키는 Electron safeStorage로 보호합니다. 재전송·본문 변조를 검사합니다.
4. Neon/Postgres의 ct_usage_bucket, ct_request_nonce, ct_admit_request로 서버 인스턴스 간 사용량을 원자적으로 제한합니다. IP는 HMAC으로 변환해 저장하며 서명 없는 구버전은 낮은 한도로 호환합니다. 장부 장애 시 유료 AI 호출 전에 차단합니다.
5. 품질 평가 도구에서 상품 ID 정밀도/재현율, 오탐, 오류를 구분하고 개발·홀드아웃 그룹 중복을 막습니다. Sharp 0.35.5로 API 운영 의존성 감사 결과는 0건이었습니다.

## 검증 결과와 한계

- API 115개, PC 단위 테스트 144개 통과. Electron 사진 대화 저장/복원 통합 검증 통과.
- 로컬 Postgres 동시 요청 30건에서 허용 10건·20 units 및 재전송 차단 확인.
- 실제 공개 API 서명 요청 200, 재전송 409, 변조 401 확인. 원본 장면을 포함한 상품 분류/후속 질문에서 광선검 확인.
- 잘린 광선검 사진만 전송하면 빨간 칫솔로 오인한 실제 실패 사례가 있습니다. 원본 문맥이 도움된 단일 사례이며 보편 정확도를 증명하지 않습니다.
- 실제 판매처 자동 검색은 현재 Google 계정 제한 때문에 search_unavailable/후보 0입니다. Vision은 BILLING_DISABLED, grounded search는 429, 일부 모델은 새 계정 404였습니다. 기능 구현과 공급자 이용 가능 여부를 구분하세요. 결제 등록은 사용자가 보류했습니다. 임의 결제나 유료 전환 금지.
- 개발 평가 자료는 통제된 판매 사진 2건뿐이며 홀드아웃 0건입니다. 상용 정확도나 완성품이라고 보고할 수 없습니다. 실제 다양한 상품·배경·모션·조명·가림 자료와 권한 있는 상품 카탈로그가 필요합니다.
- 익명 설치 서명은 회원 로그인·기업 권한·앱 진위 검증이 아닙니다. units는 실제 청구 금액 상한이 아닙니다. Live 세션 전체 비용 계량, 회원·조직·구독·결제·관측 체계는 별도 작업입니다.
- 최신 Windows 설치/포터블 0.1.64는 이전 PC Downloads에 생성되었습니다. 정식 코드 서명·Android 최신 통합·Galaxy A15 실기기 장시간 검증은 남았습니다. 현재 목표는 새 기능보다 실제 상품 찾기 정확도와 판매처 연결을 증명하는 것입니다.

## 집 PC 실행

Node.js와 Git을 준비한 뒤 저장소 루트에서:

```powershell
cd cleantouch-project/cleantouch-search-api
npm.cmd ci
npm.cmd run build
npm.cmd test
cd ../cleantouch-desktop
npm.cmd ci
npm.cmd run start
```

앱은 기본 공개 중계 https://cleantouch-place-ai-20261006.netlify.app 에 연결됩니다. 앱 사용자는 키가 필요 없습니다. 로컬 API 개발은 .env.example을 참고하여 운영자가 별도로 설정합니다. 실제 키·DB URL·로그인 파일은 이전하지 않습니다. 일부 Electron 통합 검증은 Git에서 제외한 로컬 이미지 fixture가 필요합니다. 없으면 새로 허가된 테스트 이미지를 준비하고 실행하세요.

Windows 패키지: desktop 폴더에서 npm.cmd run dist:win. Android: Java 17, Android SDK 36 및 local.properties를 집 PC 경로로 구성한 뒤 gradlew.bat :app:assembleDebug. Android Studio에서 프로젝트를 열어 SDK를 설치할 수 있습니다.

## 서버 배포 주의

Netlify site ID: 618a8428-221c-4a3e-983b-89e689ef0a1e. 마지막 공개 배포: 6ad17c640b7050573a589578. DB 원장이 적용된 상태입니다. .env.example 외 비밀값은 포함하지 않습니다. 새 PC에서 Netlify에 직접 로그인해야 합니다.

API npm run build 후 함수 배포. netlify.toml base는 cleantouch-project/cleantouch-search-api이며 실제 migration 설정은 [database.migrations] path="db/migrations"입니다. 정식 SQL은 db/migrations/20261016010000_usage_guard/migration.sql. 과거 netlify/database 경로와 혼동 금지. Windows 배포 시 Linux sharp 0.35.5/libvips 1.3.4 네이티브 의존성 포함 여부 확인. provision-usage-store.cjs와 inspect-deploy-state.cjs는 운영 도구이므로 설명과 대상 사이트를 확인하고 사용하세요. health만으로 DB 준비를 판단하지 말고 실제 서명 요청을 확인하세요.

## 이어서 할 일

1. 실제 판매 후보 검색 공급자 사용 가능 여부를 확정하고 권한 있는 다품목 카탈로그를 연결합니다. 계정·결제 결정이 필요하면 상태를 설명하고 사용자에게 묻습니다.
2. 독립적인 실제 상품 평가 세트를 모아 분류→후보 검색→상세 사진 검증→옵션별 링크의 전체 흐름을 검증합니다. 불확실하면 비슷한 후보 또는 찾지 못함을 명시합니다.
3. 최신 PC 개선과 익명 서명·호환 정책을 Android에 통합하고 A15 실기기에서 권한·공유·터치·접기·네트워크·배터리를 검증합니다.
4. 출시 전 회원/조직 권한, 실제 비용 상한과 관측, 개인정보 보존·삭제, Windows/Android 정식 서명, 구독 결제를 준비합니다. B2B/B2C 및 글로벌 계획은 PPT-IMPLEMENTATION.md와 최신 사업화 PPT를 참고합니다.

세부 문서: desktop/QUALITY-0.1.64.md, API/USAGE-PROTECTION.md, API/QUALITY-EVALUATION.md (각 실제 폴더명은 위 구조 참고).

## 새 대화에 붙여넣을 문장

HOME-PC-HANDOFF-20261016.md와 cleantouch-desktop/QUALITY-0.1.64.md, cleantouch-search-api/USAGE-PROTECTION.md, QUALITY-EVALUATION.md를 읽고 CleanTouch 작업을 이어가줘. 동봉한 대화내용.md에서 사용자 의도와 결정도 확인해줘. 현재 Windows 0.1.64, API 배포는 완료했지만 판매처 자동 검색은 공급자 제한으로 막혀 있고 일반 상품 정확도 평가는 부족해. 이를 완료됐다고 말하지 말고 정확한 상품 찾기와 실제 상세 구매 링크를 우선 검증해줘. 소비자에게 API 키 발급을 요구하지 말고 기존 소스·데이터를 보존해줘.
