# 최신 작업 정리 — CleanTouch PC 0.1.41 (2026-10-12)

## PC 0.1.41 앞선 대화 기억 누락

- 사용자는 AI의 문제를 “앞에서 한 말을 잊거나 엉뚱하게 답함”으로 지정했습니다. 최근 12/40개 발화만 전달하던 경로를 별도 `contextMessages` 메모로 보강했습니다. 메모는 첫 32/최근 128개, 최대 160개 발화이며 질문 직전에 최대 16,000자로 구성합니다. 모델/서버 변경은 하지 않았습니다.
- `conversation-context.js`, `chat-memory.js`, `chat-store.cjs`는 실제 텍스트만 보존하고 재생 중복을 합치며 최신 정정의 순서를 유지합니다. 새 대화 메모는 비우고 선택한 대화의 메모만 복원합니다. Live 연결 갱신 및 사진 질문에도 메모를 전달합니다. 사진 메시지의 기존 제한을 유지합니다.
- `place-chat.js`와 `renderer.js`에서 AI 채팅 안 상품 분석을 현재 대화에 이어갑니다. 명시적 새 대화가 아닌 상품 선택이 대화를 초기화하던 경로를 고쳤습니다. 앱 밖 상품 카드의 새 분석 동작은 기존 방식입니다.
- 단위 93개, 소스/asar 통합, 실제 QA 기억 검증 통과. 180개 중간 발화 뒤와 대화 닫기/재연결 뒤 모두 이름·색상·최신 예산을 정확히 답했습니다. QA 캡처/공유는 꺼져 있고 예시 데이터만 사용했습니다.
- 빌드 `dist-0.1.41-final`, 상세 품질 기록 `cleantouch-desktop/QUALITY-0.1.41.md`. 무한 기억/전반적 지능 상승으로 설명하지 않습니다. 이미 예전 저장 제한으로 사라진 메시지를 복원할 수는 없습니다.
- 설치 코드 0, 버전 0.1.41, 핵심 17개 파일 설치본/패키지/소스 일치. 기존 대화 4개의 메시지·문맥·사진 해시 및 기존 시간 보존, 생성 제목 4개 유지 확인. 새 Setup/Portable과 해시/업데이트 파일은 Downloads/artifacts에 준비했습니다. 공개 릴리스는 게시하지 않았습니다.

## PC 0.1.40 기존 대화의 공통 제목 복구

- 원인: 0.1.39의 `select()` 후 저장이 생성 상태 없는 기존 제목을 공통 fallback으로 덮어썼으며, 기존 대화에는 AI 요약 기회가 없었습니다. `chat-title-service.cjs`는 정상 제목 없는 기존 대화를 텍스트로 배치 요약합니다. 사진/화면은 보내지 않습니다.
- `chat-store.cjs`는 내용 지문을 확인한 제목 갱신을 제공하며, 늦은 제목·삭제·수정 및 완료된 제목을 예전 상태의 저장이 덮는 문제를 막습니다. 메시지와 시각은 유지합니다. `chats:changed` 이벤트로 목록/현재 제목을 갱신합니다. 같은 실패는 30분 backoff, 성공은 재호출하지 않습니다.
- 단위 88개, 소스/asar 대화 통합 및 실제 Gemini 3개 주제 배치/격리 QA 앱 자동 정리 검사가 통과했습니다. QA 앱에서 목록과 현재 제목 갱신·저장 후 보존, 캡처/공유 꺼짐 확인.
- 빌드 `dist-0.1.40-final`, 품질 기록 `cleantouch-desktop/QUALITY-0.1.40.md`. 서버/모바일 변경은 없습니다.
- 설치 코드 0 및 버전 0.1.40, 핵심 16개 파일 소스/패키지/설치본 일치. 실제 사용자 프로필의 기존 3개 대화가 모두 서로 다른 AI 제목으로 정리됐고, 메시지·문맥·사진 해시와 기존 시각이 보존됐음을 확인했습니다. Setup/Portable은 Downloads/artifacts에 저장하고 해시/업데이트 파일을 준비했습니다. 공개 릴리스는 게시하지 않았습니다.

## PC 0.1.39 사진 첨부와 대화 이동

- 사진 업로드의 `selectImport()`에서 새 대화 초기화를 제거했습니다. 기존 기록 ID와 메시지를 유지하고 사진을 첨부 메시지로 추가합니다. 새 대화 버튼은 이전 사진을 가져오지 않습니다.
- 대화 선택/새 대화는 사이드바를 닫지 않습니다. `chat-title.js`는 기존 응답에 요약 제목을 요청하고 표식을 본문에서 숨깁니다. 제목 전용 호출은 없습니다. `chat-store.cjs`의 `titleGenerated`로 생성된 제목을 복원합니다.
- 단위 84개, 소스/최종 asar 통합 및 실제 Gemini 제목 생성 검사 통과. 실제 일반 질문에서 “영상 속 가방 비교 특징” 제목을 받았습니다. 사진 첨부 ID/기록 수 유지·이전 메시지/사진 유지·사이드바 유지·제목 메타데이터 미노출을 검사했습니다.
- 빌드 `dist-0.1.39-final`. 상세 품질 기록 `cleantouch-desktop/QUALITY-0.1.39.md`. 이번 서버/Android 변경은 없습니다.
- 실제 설치 버전 0.1.39, 설치 코드 0, 핵심 파일 15개 설치본/패키지/소스 일치. 실제 사용자 프로필의 이전 대화를 선택해 사이드바 유지와 메시지 복원을 직접 확인했습니다. Setup/Portable은 Downloads 및 artifacts/downloads에 저장하고 해시/업데이트 파일을 준비했습니다. 공개 릴리스는 게시하지 않았습니다.

## PC 0.1.38 일반 채팅, 공유 동의, 사용 가이드

- 최신 검증과 한계는 `cleantouch-desktop/QUALITY-0.1.38.md`를 읽습니다. AI 창 열기와 일반 질문은 화면 캡처/전송을 시작하지 않습니다. 사진 없는 질문도 실제 Gemini 연결에서 답변을 확인했습니다.
- `capture-consent.cjs`는 메인 프레임의 일회성 캡처 허용만 받습니다. `share-permission.js`는 사용자의 공유/로컬 스캔 동의를 받습니다. 오디오는 차단합니다. 공유 종료 시 텍스트 채팅을 유지하며 AI가 시작한 캡처만 해제합니다. 기존 로컬 스캔은 별도로 유지합니다.
- `tutorial.js`에 처음 실행 안내와 5단계 사용 가이드를 추가했습니다. 상단과 위젯에서 재실행할 수 있습니다. 연습은 실제 캡처/AI 호출/외부 이동이 없습니다.
- PC 단위 81개, 최종 asar 대화 통합/가이드 검사 통과. 실제 허용 전 이미지 미전송, 허용 후 전송, 공유 종료 후 질문 답변과 프레임 중단을 확인했습니다. 후속 실제 검사는 열린 페이지에 영상이 없어 안전하게 중단됐고, 최종 캡처 소유권/취소 처리는 모의 스트림 검사로 확인했습니다.
- 빌드 폴더 `dist-0.1.38-final`. Android 0.4.8과 공개 서버는 이번 작업에서 변경하지 않았습니다. 기존 대화 파일을 삭제하지 않습니다.
- 설치 코드 0 및 실제 설치 버전 0.1.38 확인, 핵심 파일 14개 설치본/asar/소스 일치. 실제 프로필의 가이드·공유 꺼짐·대화 목록을 화면에서 확인했습니다. 새 Setup/Portable을 Downloads와 artifacts/downloads에 복사하고 해시/업데이트 파일을 준비했습니다. 공개 릴리스는 게시하지 않았습니다.

## PC 0.1.37 대화 기록과 유사 상품 검색

- 최신 검증과 제한은 `cleantouch-desktop/QUALITY-0.1.37.md`를 읽습니다. 아래 0.1.36 안정화는 유지했습니다.
- `chat-store.cjs`의 직렬/원자적 JSON 저장과 `chat-memory.js`의 사이드바 목록, 대화 선택/새 대화/삭제를 추가했습니다. 최근 40개·24MB·대화별 120개 메시지, AI 문맥 40개 발화. 전체 공유 프레임은 저장하지 않습니다.
- X와 공유 재연결로 기존 대화를 지우지 않습니다. 사진·검색 카드·AI 문맥을 복원합니다. `live-screen.js`는 새 연결에 대화와 마지막 상품 참고 사진을 전달합니다. 늦은 도구 응답이 다른 대화로 들어가지 않게 차단했습니다.
- `shopping-cards.js`는 질문 시점의 JPEG 상품 사진, 표시한 검색어와 동일한 Google 쇼핑 검색, 직접 사진을 전달하는 Lens 비교를 제공합니다. 실제 검사에서 CSP 때문에 data URL fetch가 차단되어 도구 응답이 실패하던 문제를 찾아 base64→Blob 변환으로 수정했습니다.
- API는 `find_similar_products` Live 도구와 `task:similar` 검색 출처 검증 경로를 추가했습니다. `shoppingTools:true`를 보내는 새 PC에만 도구를 제공해 구버전 Live가 도구 응답을 기다리며 멈추지 않게 했습니다.
- 실제 Google 검색은 현재 계정에서 429 사용 한도 응답입니다. 판매 후보 링크는 실제 검사에서 0개입니다. 쇼핑/Lens 카드가 정상 작동하고 판매처·유사율 숫자를 만들지 않습니다. 새 계정에 2.5 모델을 쓰려는 검사도 404이므로 최종 코드는 사용 중인 3.1 모델을 유지합니다. 미검증 판매 후보를 고유 상품으로 소개하지 않습니다.
- Netlify 성공 배포 `6acc2eba7b9a61cfb8d2713a`, 기존 URL 유지. 다음 중복 배포는 Forbidden이었지만 성공한 서버에서 실제 구매 카드 검사 통과. 사용자 계정/결제 설정은 바꾸지 않았습니다.
- PC 단위 75개, API 61개, source/asar Electron 통합, 실제 YouTube+Gemini 구매 카드·닫기·재열기·저장 대화 선택 검사 통과. build output은 `dist-0.1.37-final`입니다.
- 최종 패키지 프로세스를 재시작해 기존 3개 구매 카드·대화·문맥이 복원되고, 공유는 자동 시작하지 않으며 큰 화면 사이드바가 보이는 것을 확인했습니다. 실제 프로필의 앱을 정상 종료하고 NSIS 설치 코드 0 및 설치 버전 0.1.37을 확인했습니다. 설치된 10개 핵심 파일은 최종 패키지/소스와 동일합니다. 설치 파일과 포터블은 Downloads 및 artifacts/downloads에 있고 SHA256 및 update-release 메타데이터를 생성했습니다. 새 GitHub 릴리스는 공개하지 않았습니다.
- 사용자가 올린 화면의 초록색 광선검 대화 텍스트를 `AppData/Roaming/cleantouch-desktop/conversations.json`에 보존했습니다. 전체 스크린샷은 저장하지 않았습니다. 이 파일을 삭제하지 않습니다.
- 설치된 일반 사용자 앱 PID 32508을 정상 실행했고 실제 화면에서 AI 창과 사이드바를 열어 보존한 대화가 표시됨을 확인했습니다. 현재 공유는 시작하지 않은 상태입니다. 설치된 UI 증거는 `artifacts/verification/installed-0.1.37-history.png`입니다. 다운로드 폴더와 artifacts의 설치 파일 SHA256이 같습니다.
- 이번 변경은 PC 전용입니다. Android APK 0.4.8에 새 대화 UI가 적용됐다고 안내하지 않습니다. 이전에 다운로드 서버 변경이 자동 승인 검토에서 거절됐으므로 HTTP 다운로드 서버를 새로 띄우는 시도는 하지 않습니다.

## PC 0.1.36 안정화 완료

- 최신 동작·검증·제한은 `cleantouch-desktop/QUALITY-0.1.36.md`와 최신 README를 먼저 읽습니다. 아래 예전 키/LAN 서버 기록은 현재 PC 앱에 적용되지 않습니다.
- 위젯/대화 UI, 취소·재개·빈 답변·Live 재연결·오래된 결과 차단·캡처 실패 시 전체 화면 전송 방지·동일 연속 JPEG 저장 방지를 수정했습니다. 키/서버 설정 IPC를 제거했습니다.
- 초기 Live 답변이 실제 장면과 다르던 문제를 발견해 프레임과 질문을 순서 보장되는 clientContent 문맥으로 통일하고 답변 중 프레임이 답변을 끊지 않게 했습니다. 실제 질문 이미지와 첫/후속 응답이 일치하는 것을 확인했습니다. 공유는 초당 최대 한 장이며 소리는 보내지 않습니다.
- 데스크톱 단위 테스트 69개, API 테스트 58개, Electron 통합 3종, 실제 로컬 가방 마스크와 공개 서비스 가방 인식/쇼핑 검색어, 실제 Live 재연결/종료 검사 통과. 실제 재연결 시험에서는 8분 타이머를 단축했습니다.
- Netlify 기존 사이트 프로덕션 배포 ID `6acc208d45b55335bab41c8e`; URL `https://cleantouch-place-ai-20261006.netlify.app`. 운영자 키는 출력/패키징하지 않았습니다.
- 최종 Windows 빌드: `cleantouch-desktop/dist-0.1.36-verified`. 빌드 zip 임시 폴더 rename EPERM을 피하기 위해 `--config.electronDist=node_modules/electron/dist`로 검증에 쓰던 로컬 Electron을 사용했습니다.
- NSIS 설치 종료 코드 0, `C:/Users/first2000/AppData/Local/Programs/CleanTouch/CleanTouch.exe` 버전 0.1.36.0 확인 및 설치된 핵심 파일/검증 패키지 일치 확인. 새 앱이 일반 사용자 프로필에서 열려 있고 화면 공유는 시작하지 않았습니다.
- 설치 파일: `C:/Users/first2000/Downloads/CleanTouch-Setup-0.1.36.exe`. 두 exe, SHA256, 업데이트 메타데이터는 각각 `artifacts/downloads`, 최종 빌드의 `update-release`에 있습니다. exe를 Orca 편집기로 열면 크기 제한이 있으므로 설치된 앱 또는 Windows 탐색기를 사용합니다.
- 다운로드 서버 작업이 자동 승인 검토에서 `blocked by policy`로 거절되어 더 시도하지 않고 사용자에게 설명했습니다. 기존 8100 서버는 이전 코드를 메모리에 갖고 있을 수 있으므로 새 0.1.36 HTTP 링크를 제공하지 않았습니다.
- Android 기존 0.4.8 단위 테스트/lint 통과. PC 기능의 모바일 포팅·A15 실기기 검증·Windows 코드 서명·GitHub 정식/자동 업데이트 배포는 남아 있습니다. 모든 사이트/상품 인식을 완성했다고 주장하지 않습니다.

## 이전 작업 기록

## Windows PC 앱 0.1.1 — 별도 설치 파일

- `cleantouch-desktop`에 Windows 설치형과 휴대형 실행 파일을 만들었습니다. 화면/유튜브 창을 선택해 시청 중 장면을 모으고, 중지하면 상품 검색 링크를 표시합니다.
- 각 사용자의 Gemini 키를 Windows 계정으로 암호화해 저장하는 직접 분석 모드와 기존 검색 서버 연결 모드를 제공합니다. 직접 분석에는 같은 와이파이가 필요 없고, 각자 키 사용량이 집계됩니다.
- `http://192.168.100.103:8100/`에서 Android APK와 두 Windows 파일을 같은 네트워크로 제공합니다. 다른 네트워크로 공개 배포할 사이트는 아직 연결되지 않았습니다.
- 검색 서버 테스트 36개 통과, Windows 앱 패키지 빌드 완료, 패키지 화면 캡처→테스트 서버 상품 응답 검증 통과. 실제 Gemini 이미지 분석은 기존 503 때문에 아직 성공 검증되지 않았습니다.

## 0.3.3 — 분석 요청 수 제한과 503 대기 안내

- 새 녹화는 최소 5초 간격, 최대 24장면을 분석하고 마지막 장면을 포함합니다. 기존 2/78 녹화는 저장된 2초 간격을 유지해 이어서 분석합니다.
- Gemini 일시 장애 503의 `Retry-After`가 있으면 앱에 다음 시도 시각을 저장하고, 없으면 30초 대기를 적용합니다. 완료 결과와 원본 녹화는 유지합니다.
- Android 버전은 0.3.3 / versionCode 7입니다. 실기기 인식 성공 여부와 실행 중인 검색 서버의 Gemini 재시작은 아직 확인되지 않았습니다.

## Gemini 전환 — 설정 완료, 실제 생성 요청 503 (2026-09-28)

- 사용자는 Groq 대신 Gemini를 선택했습니다. 로컬 `cleantouch-search-api/.env`에 키가 저장되어 있고 `SEARCH_PROVIDER=gemini`, `GEMINI_MODEL=gemini-3.8-flash`입니다. 키 내용은 출력하거나 APK에 넣지 않습니다. `.env`는 Git 제외 대상입니다.
- `scripts/check-gemini.mjs`는 `.env`의 모델을 사용합니다. API 키로 모델 목록을 조회하면 HTTP 200이지만, 실제 이미지 생성 요청은 Gemini 3.8 Flash와 3.6 Flash 모두 HTTP 503을 반환했습니다. 상품 분석 성공은 아직 확인되지 않았습니다.
- Gemini provider는 500/502/503/504와 연결 오류를 한 번만 지연 재시도합니다. 긴 `Retry-After`가 오거나 재시도 뒤에도 실패하면 앱 서버는 안전한 `503 / PROVIDER_UNAVAILABLE`와 재시도 안내를 반환합니다. 429 quota 처리는 기존 `Retry-After`, `RetryInfo`, `QuotaFailure` 지원을 유지합니다.
- Android 응답 제한 시간을 90초로 늘렸고, Gemini 응답 시간 초과를 와이파이 연결 오류와 구분합니다. 실패해도 완료 결과와 원본 녹화를 보존합니다. 앱 버전은 0.3.2 / versionCode 6입니다.
- 검증: 검색 서버 테스트 36개와 빌드 통과. Android 단위 테스트·린트·APK 빌드 통과. 새 APK는 `cleantouch-android/app/build/outputs/apk/debug/app-debug.apk`이며 같은 와이파이 다운로드는 `http://192.168.100.103:8099/app-debug.apk`입니다.
- 실제 검색 서버 프로세스는 설정 변경 전 빌드된 코드로 실행 중입니다. 현재 `/health`에는 `provider`와 `model`이 없으며 새 소스의 `/health`에는 둘 다 표시됩니다. 코드를 빌드해도 실행 중인 프로세스는 자동 갱신되지 않으므로 포트 8790의 프로세스를 다시 확인해 재시작한 뒤 `/health`를 확인해야 합니다. PID는 재사용 전에 다시 조회합니다.
- 실제 API의 503 때문에 상품 결과·전체 장면 분석·실기기 확인은 미검증입니다. 연결 검사 성공으로 보고하지 않습니다.

## 0.3.1 — 2/78에서 한도 오류로 멈추는 문제

- 사용자가 "이어서 분석" 후 2/78에서 한도 초과 메시지와 함께 다시 멈춘다고 확인했습니다. 2/78은 상품 수가 아니라 전체 78개 분석 장면 중 완료한 장면 수입니다.
- 실제 Groq 응답을 확인해 **분당 토큰 처리량 제한**임을 확인했습니다. 해당 응답은 `Retry-After: 30`을 포함했습니다. 당시 진단만으로 일일 한도 소진이나 유료 전환 필요로 해석하지 않습니다.
- 검색 서버가 버리던 재시도 대기 시간을 `Retry-After`, `retryAfterSeconds`로 앱에 전달합니다. 확인 가능한 분당/일일 제한을 구분하고, 모든 제한을 "무료 한도 초과"라고 부르던 문구를 수정했습니다. 계정 식별자와 원문 오류는 외부 응답에 넣지 않습니다.
- Android는 2분 이하 대기인 경우 장면당 최대 2회 자동 재시도합니다. 헤더가 없는 이전 서버는 60초를 기다립니다. 일일 제한·2분 초과 대기·반복 실패는 녹화와 결과를 보존하고 수동 재개로 전환합니다.
- 대기 시간과 완료 장면 수를 표시하고, 중단 상태에서도 진행 수치를 유지합니다. 재시도 가능 시각을 저장하므로 재실행이나 버튼 반복으로 대기 시간을 무시하지 않습니다. 이미 완료한 장면은 건너뜁니다.
- 검증: 검색 서버 테스트 **23개** 및 빌드, Android 테스트 **8개**·린트·APK 빌드 통과. 자동 재시도 성공, 반복 제한 종료, 일일/긴 대기, 이전 서버 호환, 대기 취소, 일반 네트워크 오류를 검사했습니다.
- 대기 후 실제 API 요청은 **HTTP 200**, 테스트 이미지에서 크림색 니트 재킷·블랙 숄더백 2개를 반환했습니다. 응답: `artifacts/recognition-tests/rate-limit-20260928-response.json`. 사용자의 실제 78개 장면 전체 완료와 새 APK의 실기기 화면은 아직 미검증입니다.
- 검색 서버는 수정본으로 재시작했습니다. 로그: `.local/cleantouch-rate-limit-search.{out,err}.log`.
- 새 APK는 versionCode **5**, **0.3.1-debug**입니다. 기존 debug 앱에 업데이트 설치한 뒤 "저장된 녹화 이어서 분석"을 누릅니다. 같은 와이파이 다운로드: http://192.168.100.103:8099/app-debug.apk

## 이전 재개 시점의 정리

사용자 요청: "위에 하던 내용 정리후 이어서 해줘". 이전 대화 전체 대신 파일·문서·수정 시각을 확인해 복원한 내용입니다. 가장 최근 개발 작업은 2026-09-23의 CleanTouch 0.3이며, 아래 9월 15일 게시판 기록보다 이 항목을 우선합니다.

## 지금까지 구현한 내용

- Android: 앱 안 원형 OFF 버튼 → 동의 및 Android 화면 공유 → ON 동안 무음 녹화 → OFF 또는 알림의 종료 버튼 → 자동 상품 분석.
- 플로팅 버튼과 다른 앱 위 표시 권한은 제거했습니다. 고정 10초 제한 없이 사용자 종료까지 녹화하며, 시스템 종료·저장 공간 한도는 예외입니다.
- 약 2초 간격과 마지막 장면을 분석해 여러 상품의 사진·등장 시점·쇼핑 검색 링크를 표시합니다. 동일한 검색 링크의 상품은 중복 제거합니다.
- 분석 중지·실패 시 녹화와 완료한 결과를 보존하고 이어서 분석합니다. 앱 재실행 후 최신 상태를 복원합니다. 정상 분석 완료 후 해당 원본 MP4만 삭제합니다.
- 웹은 같은 ON/OFF 흐름을 체험하는 시제품입니다. 결과 3개는 예시 데이터이며 실제 화면 녹화·AI 분석은 Android에서 수행합니다.
- 검색 링크는 AI가 읽은 특징으로 만든 검색어를 사용합니다. 동일 상품·정확한 가격·모든 상품 인식을 보장하지 않습니다.

## 이번에 이어서 한 작업과 검증

- 중지돼 있던 웹(5180)·콘텐츠 API(8787)·상품 검색 API(8790)·APK 제공 서버(8099)를 백그라운드로 다시 실행했습니다.
- 웹·SDK·검색 서버 빌드와 검색 서버 테스트 **19개**가 통과했습니다.
- Edge 자동 검증: 동의 취소, 11초 이상 ON 유지, 영상 위 버튼 없음, OFF 후 자동 예시 결과, 상품 검색·필터·새 세션, 모바일 가로 넘침 없음, JS 오류 없음을 확인했습니다.
- Android 린트에서 API 27 전용 `windowLightNavigationBar`를 API 26 기본 스타일에서 사용한 오류 1개를 발견했습니다. 공통 테마를 두고 해당 속성을 `values-v27/styles.xml`로 분리했습니다.
- 수정 후 Android 단위 테스트 **2개**, `lintDebug`, `assembleDebug`가 통과했습니다. 린트 권고 경고는 17개 남아 있습니다.
- 휴대폰용 APK는 `http://192.168.100.103:8790`을 API 주소로 다시 빌드했습니다. 이번에는 휴대폰·에뮬레이터에 설치하지 않았습니다.
- 검색 API `/health`는 정상이며 공급자 키가 설정돼 있습니다. 기존 상품 테스트 이미지로 실제 요청 1회를 보냈지만 **HTTP 429 / PROVIDER_RATE_LIMITED**가 반환됐습니다. 실제 AI 전체 성공 경로는 계속 미검증입니다.

## 접속·산출물

- 웹 체험: http://127.0.0.1:5180
- 같은 와이파이 휴대폰 APK 다운로드: http://192.168.100.103:8099/app-debug.apk
- APK 파일: `cleantouch-android/app/build/outputs/apk/debug/app-debug.apk`
- 이번 실제 AI 응답: `artifacts/recognition-tests/resume-20260928-scene.json`
- 웹 검증 스크린샷: `artifacts/cleantouch-toggle-home.png`, `cleantouch-toggle-results.png`, `cleantouch-toggle-mobile.png`
- 실행 로그: `.local/cleantouch-resume-{web,search,apk}.{out,err}.log`
- 개발 서버는 PC 재시작 후 다시 실행해야 합니다. IP가 바뀌면 APK의 개발 API 주소도 갱신해야 합니다.

## 이어서 확인할 일

1. 공급자 사용량 한도가 풀린 뒤 실제 녹화 전체의 분석 완료·상품 사진·중복 제거·원본 MP4 삭제·실패 후 재개를 확인합니다. 현재 웹 체험이나 모의 공급자 테스트를 실제 AI 성공으로 보고하지 않습니다.
2. 실기기 장시간 녹화·회전·잠금·권한 거절·저장 공간 부족을 검증합니다. 9월 23일 기록은 Android 16 에뮬레이터에서 53초 이상 녹화 및 오류 후 복원까지입니다.
3. `presentation/`의 발표자료·PPT·PDF는 9월 22일의 플로팅 버튼/한 장 캡처 버전입니다. 현재 0.3 설명으로 사용하려면 별도 갱신이 필요합니다.
4. 출시 관련 HTTPS·정식 서명·상품 카탈로그·가격 연동은 미완료입니다. 세부 항목은 `cleantouch-android/PRODUCTION-CHECKLIST.md`를 봅니다.

## 관련 파일과 재검증 명령

- 제품/웹: `cleantouch/PRODUCT-PLAN.md`, `cleantouch/README.md`, `cleantouch/src/ScanApp.tsx`
- Android: `cleantouch-android/README.md`, `MainActivity.kt`, `capture/ScreenCaptureService.kt`, `search/RecordingAnalyzer.kt`, `search/ScanSessionStore.kt`
- 서버: `cleantouch-search-api/src/app.ts`, `groq-provider.ts`, `gemini-provider.ts`

```powershell
npm.cmd run test:cleantouch-search
npm.cmd run build:cleantouch
npm.cmd run build:cleantouch-search
node scripts/check-cleantouch-toggle.mjs
cd cleantouch-android
.\gradlew.bat testDebugUnitTest lintDebug assembleDebug -PCLEANTOUCH_DEBUG_API_URL=http://192.168.100.103:8790
```

브라우저 검증 전 5180 서버가 실행돼 있어야 합니다. Git은 아직 최초 커밋이 없으며 프로젝트 파일들이 untracked 상태입니다. 기존 게시판 DB `.local/pgdata`, 로컬 키와 `.env`, 기존 작업 파일을 보존합니다.

---

# 이전 작업 — 답글 관리·설정·프로필·맞팔 DM (2026-09-15)

- 요청 기능 전부 구현: 본인 답글 수정/삭제, 이름 아래 라이트/다크 및 한국어/영어 설정, 프로필·사람 검색·팔로우, 설정에서 갤러리/카메라 프로필 사진 변경, +글쓰기 오른쪽 종이비행기 DM.
- DM은 맞팔끼리만 전송. 맞팔 해제 시 기존 기록만 열람. 제3자 조회 불가. 3초 폴링, 50개씩 이전 기록, 요청 UUID 중복 저장 방지.
- 사진은 512px JPEG로 변환, 서버는 최대 512KB. 카메라 getUserMedia 스트림은 종료 시 정리.
- 추가 파일: backend/src/social.ts, frontend/src/Settings.tsx, People.tsx, Replies.tsx, Messages.tsx, Avatar.tsx, i18n.tsx.
- 추가 스키마 적용 완료. 기존 DB 데이터 유지. API 테스트 9개, 빌드, 기존/새 Edge 브라우저 검증 통과.
- 가상 카메라 촬영·저장과 권한 거절을 자동 검증. 실제 기기 카메라는 미검증.
- 상세 사용법·API·실행·테스트는 README.md 8절 참조.
- 아래 기록들은 이전 시점 인계 내용으로, '답글 수정·삭제 없음' 등은 이제 위 내용으로 대체합니다.

---

# 최신 구현 상태 — 2026-09-15

이 세션에서 인계 문서를 읽고 기능 구현과 실제 DB/Edge 검증을 완료했습니다.
아래의 원래 인계 기록 중 "기능 미수정" 설명은 이전 세션 당시의 기록입니다.

- 구현: 중복 없는 guest 5자리 이름, 익명 쿠키 유지, 설정에서 이름 변경, 한 단계 답글, 👍 개추 좋아요/취소.
- backend/src/visitor.ts 추가. DB UNIQUE와 토큰 해시, HttpOnly 쿠키 사용.
- schema.sql은 추가형 변경만 적용. 기존 글은 원래 작성자 유지, 새 글·답글은 현재 닉네임 표시.
- 기존 누구나 글 수정·삭제 정책 유지. 작성자 위조 입력은 무시.
- 실제 PostgreSQL 테스트 6개 및 Edge 브라우저 검증 통과. TypeScript·양쪽 빌드 통과.
- 브라우저: 재접속, 두 사용자, 이름 충돌/변경, 답글 오류/재시도, 좋아요 유지/취소, CRUD, 모바일 390px, JS 오류 없음.
- 적용 전 실제 기존 게시글은 0개. 별도 기존 형식 글의 보존과 마이그레이션 재실행을 테스트.
- 테스트 생성 데이터만 정리. .local/pgdata 보존.
- 접속: http://localhost:5173 (DB 5433, API 3001). 서버 백그라운드 실행.
- 자세한 사용법과 검증 명령은 README.md 7절 참조.
- 해결한 환경 문제: 중지된 DB 재시작, PowerShell UTF-8 BOM의 SQL 파싱 오류 수정.
- 쿠키 삭제/만료 또는 다른 브라우저에서는 새 사용자. 로그인·사용자 복구·대댓글 기능은 없음.

---

# Orca 인계 기록 — practice-board
작성일: 2026-09-15 (Asia/Seoul)

## 가장 최근 사용자 요청 (원문)
> 이름은 처음에 들어오면 guest(랜덤숫자5자리 중복x)로 결정하고, 설정에서 이름 바꿀 수 있게, 그리고 게시판에 답글 기능 만들어주고 해당 게시물에 개추, 따봉 이모지(좋아요 기능) 만들고 내가 말한 기능들 추가하기전에 오르카로 실행환경 넘어가줘. 대화내용 기억할 수 있게

## 순서와 현재 상태
- 사용자는 기능 추가 전에 Orca로 작업 환경을 옮기라고 요청했다.
- 기존 세션에서는 새 기능 코드를 아직 수정하지 않았다.
- Orca에서 이 문서를 읽고 기존 코드를 확인한 후 실제 구현, DB 변경, 테스트까지 진행한다.
- 이것은 대화 요약과 작업 인계 문서다. 원래 채팅 전체가 자동으로 이식되었다고 말하지 않는다.
- 프로젝트 원본 폴더: C:\Users\first2000\practice-board
- Orca 1.4.201 설치 및 로컬 런타임 ready 확인.
- CLI: C:\Users\first2000\AppData\Local\Programs\orca\resources\bin\orca.cmd
- 새 worktree를 만들면 미커밋 코드/.env/.local이 따라가지 않는다. 이 기존 폴더를 그대로 사용한다.
- 기능 구현은 Orca 세션 한 곳에서 담당한다. 원래 세션에서 중복 구현하지 않는다.

## 대화 요약 / 원래 목표
- 혼자 연습할 실제 작동하는 간단한 웹 게시판.
- React + TypeScript 프론트엔드, Node.js + TypeScript 백엔드, PostgreSQL.
- 목록/상세/작성/수정/삭제, 조회수, 작성일 구현을 요청했고 완료했다.
- posts: id, title, content, author, views, created_at, updated_at.
- 초보자가 읽기 쉬운 코드와 폴더, 최소 라이브러리, frontend/backend 분리.
- 로그인은 구현하지 않는다. 기존 댓글/좋아요 제외 조건은 이번 추가 요청으로 변경되었다.
- 비밀번호는 backend/.env에 저장하며 Git에 올리지 않는다.
- 필요한 명령을 직접 실행하고 각 단계가 끝날 때 한국어로 짧게 설명하며 오류를 직접 수정한다.
- 사용자는 파일 경로 안내, 탐색기로 폴더 열기, 게시판 열기를 요청했다.
- 파일 탐색기 실행은 성공. 기본 브라우저 자동 실행은 당시 도구 정책으로 거절되었고 링크를 제공했다.

## 완료된 구현과 환경
- Node v24.21.0, npm 11.19.0.
- React 19, Vite 8, Express 5, pg. 정확한 버전은 package-lock.json 참조.
- PostgreSQL 17.11 Windows 배포본: .local/pgsql
- DB 데이터: .local/pgdata (삭제/재초기화하지 말 것)
- DB: 127.0.0.1:5433, practice_board, board_user. 비밀번호는 .env에만 있고 이 문서에는 없다.
- 웹: http://localhost:5173, API: http://127.0.0.1:3001
- Vite /api 프록시 사용. 화면은 React 상태 전환, 라우터 없음.
- SQL 매개변수 쿼리, 입력 검증, JSON 오류 응답.
- 상세 GET 한 번마다 원자적 UPDATE로 views+1. 목록/수정은 조회수 증가 없음.
- 수정 시 updated_at 갱신, created_at 유지. 조회수만 바뀌면 updated_at 유지.
- 제목 200자, 작성자 50자, 본문 20,000자 제한.
- Git 저장소 main 초기화만 완료. 아직 커밋 없음. 기존 파일들은 untracked.
- .env, .local, node_modules, dist가 git check-ignore에서 제외되는 것 확인.

## 코드 읽는 순서
1. backend/sql/schema.sql
2. backend/src/app.ts, db.ts, server.ts
3. frontend/src/types.ts, api.ts, App.tsx, PostForm.tsx, styles.css
4. backend/test/api.test.ts
5. README.md

## 추가할 기능 / 구현 방향 (아래 세부 방식은 제안이며 사용자 확정사항과 구분)
사용자 필수 요구:
1. 첫 방문 시 guest + 랜덤 숫자 5자리 자동 이름. 다른 사용자와 중복 금지.
2. 설정 화면에서 이름 변경.
3. 게시물에 답글 기능.
4. 게시물에 개추 / 따봉 이모지를 사용하는 좋아요 기능.

간단한 기본 구현 제안:
- 서버에 익명 방문자 레코드를 만들고 브라우저에 방문자 식별 수단을 보존. 로그인 UI는 추가하지 않는다.
- guest10000~guest99999처럼 정확한 다섯 자리. DB UNIQUE 제약과 충돌 재시도로 중복을 막고 소진 시 명확한 오류 처리.
- 이름 변경 시에도 다른 이름과 중복을 막고 길이/빈 문자열 검증.
- 작성자 입력칸을 자동 닉네임으로 연결. 안정적인 방문자 ID와 표시 이름을 분리한다.
- 기존 글과 데이터는 유지하는 추가적 SQL 마이그레이션을 사용한다.
- 답글은 우선 게시글 아래 1단 답글 목록/작성으로 해석 가능. 대댓글까지 사용자가 명시한 것은 아니다.
- 좋아요는 우선 '👍 개추' 버튼 하나와 개수, 내 선택 상태 표시로 해석 가능. 두 개의 별도 반응을 명시적으로 확정한 것은 아니다.
- 방문자별 게시물 좋아요 1개, 재클릭 취소. DB UNIQUE로 중복 클릭/동시 요청에도 개수 일관성 유지.
- 서버가 익명 식별자를 확인해 동작하도록 하고 클라이언트가 임의 author를 보내는 방식에만 의존하지 않는다.
- 이름 변경 후 기존 글/답글 표시 정책을 정하고 README에 설명한다.
- 테스트: 닉네임 충돌/유지/변경, 답글 작성/목록/없는 글 오류, 좋아요 중복 방지/취소/동시 요청, 기존 CRUD 회귀.
- 브라우저에서 실제 흐름도 확인한다. 불필요하게 라이브러리를 늘리지 않는다.

## 실행 명령 (PowerShell)
프로젝트에서:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\db.ps1 start
npm.cmd run db:init
powershell -ExecutionPolicy Bypass -File .\scripts\app.ps1 start
```
app.ps1 start는 이미 실행 중이면 stop을 먼저 요구한다. 현재 서버 상태를 확인하고 불필요한 중복 실행을 피한다.
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\app.ps1 stop
powershell -ExecutionPolicy Bypass -File .\scripts\db.ps1 stop
```
터미널을 직접 쓰려면 npm.cmd run dev:backend / npm.cmd run dev:frontend.
검증: npm.cmd test / npm.cmd run build.
로그: .local/backend.log, backend-error.log, frontend.log, frontend-error.log, postgres.log.

## 기존 검증 결과
- frontend/backend TypeScript + 빌드 통과.
- 실제 PostgreSQL 통합 테스트 2개 통과: CRUD, 동시 5회 조회수, 날짜, 입력/JSON/크기/없는 경로 오류.
- .local/browser-check/check.mjs: Playwright + 설치된 Edge로 CRUD/조회수/삭제 취소/HTML 텍스트 처리/모바일 폼 통과, JS 오류 없음.
- 테스트가 만든 글은 정리했다. 이후 사용자가 만든 글은 보존한다.
- 스크린샷 .local/browser-detail.png, .local/browser-mobile.png.
- 초기 Vite CSS 타입 선언 누락은 frontend/src/vite-env.d.ts로 수정.
- DB 초기 생성의 빈 psql 출력 처리 오류는 scripts/db.ps1 조건문 수정으로 해결.
- 브라우저 테스트 baseURL 누락은 수정 후 재검증 완료.
- PowerShell 5에서 UTF-8 문서는 Get-Content -Encoding UTF8로 읽는다. 기본 인코딩의 깨진 출력만 보고 파일 자체가 손상됐다고 판단하지 않는다.

## 완료 보고
구현 후 이 문서/README에 실제 변경과 테스트 결과를 갱신하고, 사용자에게 접속 URL 및 변경사항을 간단히 한국어로 안내한다.


