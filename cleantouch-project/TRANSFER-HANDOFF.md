# CleanTouch — 다른 PC에서 이어서 작업하기

2026-10-13 작성. 이 문서를 새 PC의 Orca/Codex 대화에 지정해서 읽게 하면 현재 작업을 이어갈 수 있습니다.

## 새 PC에서 여는 방법

1. 이전 ZIP을 새 PC로 보내 압축을 풉니다. 복원 코드가 담긴 `restore-project.ps1`을 확인할 수 있습니다.
2. Windows에 Git이 설치되어 있다면 `여기부터-프로젝트복원.cmd`를 더블클릭합니다. 또는 PowerShell로 `powershell -ExecutionPolicy Bypass -File .\restore-project.ps1`를 실행합니다. 이 스크립트는 포함된 Git 기록을 `project` 폴더에 복원하고, 수정 중인 소스는 유지합니다. API 키나 로그인 파일은 복사하지 않습니다.
3. Orca에서 `project` 폴더를 열고 아래 문장을 새 대화에 보냅니다.

> TRANSFER-HANDOFF.md와 HANDOFF.md를 읽고 CleanTouch 작업을 이어서 검증해줘. PC 0.1.42와 모바일 0.5.0 미리보기의 실제 기기 검증과 정식 배포 서명을 준비하고, 테스트되지 않은 항목을 완료됐다고 안내하지 마.

Git이 없어도 `project` 폴더의 소스를 먼저 열고 읽을 수 있습니다. Git 복원은 나중에 실행할 수 있습니다. 같은 계정으로 로그인하더라도 이 ZIP은 기존 Orca 대화 창이나 로그인 상태를 복원하지 않습니다.

## 저장소와 마지막 확정 상태

- GitHub: https://github.com/ksj-09/cleantouch
- 브랜치: `feature/cleantouch-visual-search`
- 마지막 푸시된 커밋: `237e36be8ed297ccddeda2d7d83d77bf9840b208`
- PC: 0.1.42. 대화 공유 메뉴, 다중 쇼핑몰 비교, Windows 사용자 암호화가 추가됐습니다. PC 단위 테스트 95개와 패키지 내부 버전·필수 파일 검증을 통과했습니다.
- Android: 0.5.0 ARM 미리보기 APK를 만들었습니다. Android 단위 빌드·테스트와 API 36 에뮬레이터 UI 테스트 7개가 통과했고, 대화 파일의 Android Keystore 암호화 헤더도 확인했습니다. Galaxy A15 실기기 장시간 검증과 Play release 서명은 남아 있습니다.

## 사용자 의도 — 유지해야 하는 제품 원칙

- 대부분의 고객이 스마트폰 사용자입니다. 모바일을 PC만큼 편하게 완성해야 합니다. 단순 웹뷰 복사보다 작은 위젯과 Android 권한·백그라운드 안정성이 중요합니다.
- 일반 고객은 API 키를 받거나 서버 주소를 설정하지 않습니다. 기존 공개 AI 서비스에 연결합니다.
- 영상 보다가 떠 있는 버튼 → 상품 터치 → 상품 윤곽/내용 확인 → AI 상품 분석과 구매 후보, 또는 Lens 비교. 사용자에게 사진 저장·Lens 수동 업로드를 반복시키지 않습니다.
- 모두 분석은 장면 수집을 자동으로 일시정지하고 고정된 목록을 처리해 끝나야 합니다. 중단·재개와 중복 억제가 필요합니다.
- 특정 상품 목록/광선검 전용으로 제한하지 않습니다. 앞뒤 장면을 참고하고, 배경이나 점등 전의 일시적 색을 새 상품으로 만들지 않습니다.
- 채팅은 사진 없이 시작할 수 있어야 하고, 화면 공유는 사용자가 직접 허용한 때만 켭니다. 화면 공유 종료/대화 닫기는 내용을 지우지 않습니다.
- 사진 업로드는 현재 대화에 첨부합니다. 내 대화 사이드바에서 이전 대화를 고르면 사이드바를 자동으로 닫지 않습니다. 제목은 가능하면 AI가 짧은 주제로 요약합니다.
- UI는 PC의 크림색 배경·보라색 포인트에 맞춘 가벼운 모바일 디자인으로 변경 중입니다.

## 이번에 구현한 모바일 변경

- `MobileChatStore.kt`: 최근 40개 대화, 대화별 제한 160발화(첫 32+최근 128), 원자적 JSON 저장, 앱 전용 사진, 작성 중인 질문과 구매 링크 저장. 백업은 manifest에서 비활성화.
- `MobileChatController.kt`: Activity를 닫아도 유지하는 애플리케이션 대화 상태, 취소/오래된 응답 차단, 대화 선택/삭제/새 대화, 같은 대화에 사진 첨부, 최대 크기 제한과 EXIF 방향 보정, 앞선 조건/정정 문맥 전달.
- `MobileAiClient.kt`: 기존 중계로 Gemini Live 임시 토큰을 발급하고 OkHttp WebSocket 연결. 일반 텍스트 채팅·사진·허용한 화면 프레임 지원. 마이크/오디오 입력은 수집하지 않고 답변 전사 텍스트를 표시. 구매 질문의 `find_similar_products` 도구에 실제 출처 후보/쇼핑 검색으로 응답. API 키는 앱에 포함하지 않음.
- `PlaceChatActivity.kt`: 화면 공유 자동 시작 제거, Android 사진 선택기, 내 대화 사이드바, 같은 대화 업로드, 도움말, 공유 동의와 OS 권한 흐름, 상품 부분 선택 확인.
- `AiScreenShareService.kt`: 별도 Android MediaProjection foreground service. 공유 동의 없이 시작되지 않고 토큰 재사용하지 않음. 최대 1280픽셀 JPEG, 초당 1프레임 AI 연결. 작은 AI 버튼, 알림 종료. 공유를 위해 기존 장면 모으기를 멈추되 장면/목록 보관. 본 앱/대화창을 전송하지 않도록 일시 중단.
- `FloatingAiPanel.kt`: 영상 위에서 직접 질문·답변·구매 링크 확인하는 작은 창. 접으면 대화/작성 중 질문 유지. 이 창이 열린 동안 본 대화 내용의 캡처를 막고, 열기 직전의 장면으로 답하도록 상태를 표시함. 접기 UI 테스트가 통과했습니다.
- `MobileObjectRepository.kt`, `LocalSceneAnalyzer.kt`: 전체 분석의 고정 COCO 종류 제한을 제거하고 공개 AI의 `objects` 분석 사용. 같은 영상의 가까운 앞뒤 2장면을 함께 보내 일시적 색과 배경 오인식 억제. 오류 시 처리 완료된 장면을 보관해 다시 이어감.
- `FloatingScanService.kt`: 상품 선택 결과에 AI/구매와 Lens를 분리. 위젯에서 일시정지/계속/모두 분석. 캡처 메모리 부족 방어 및 사용하지 않은 무거운 모델이 종료 시 생성되는 문제 제거. 저장 장면 JPEG 90/1280으로 변경.
- `MainActivity.kt`, `MobileTheme.kt`: 사진 없는 AI 진입, 처음 실행 사용법·재실행, 밝은 크림/보라 UI, 상품 카드의 AI 구매/Lens 선택, 전체 분석 취소.
- Gradle: versionCode 23 / versionName 0.5.0, OkHttp 4.12.0, ExifInterface 1.4.1 추가.

## 실제 검증 결과 — 완료/미완료를 구분

- Android API 36 x86_64 에뮬레이터 `CleanTouch_API_36`에서 개발용 debug 빌드 성공.
- Android JVM 단위 테스트 **26개 통과**(대화 기억·제목·프레임·타임라인·중복 등).
- 사진 없는 대화 진입, 입력 질문을 닫기/다시 열기 후 유지, 현재 대화에 사진 첨부, 로컬 저장/읽기 및 사진 미리보기 검증 통과. 선택 실행의 6개 테스트에는 네트워크 선택 테스트 skip이 포함됨.
- `MobileShareFlowTest`를 `liveMobile=true`로 실제 실행해 **Android 권한창 → 계속 갱신되는 화면 프레임 → 화면 속 검은 가방의 색상을 실제 Gemini가 답함 → 공유 종료 후 대화 유지** 통과.
- `MobileChatTest#liveTextReplyRemembersPreviousConstraint`를 실제 실행해 사진 없는 질문/후속 질문에서 **베이지색·5만원 예산 기억** 통과.
- 마지막 실행 `MobileOverlayTest,MobileChatTest,PlaceChatTest`는 **7개 모두 통과**했습니다. 접기 동작은 UI 이벤트 완료를 기다린 뒤 상태와 작성 중 질문 보존을 확인합니다.
- 기존 Galaxy A15 실기기는 ADB에 연결되어 있지 않았습니다. **A15 실기기, 장시간 사용, 네트워크 전환/복구, 배터리 영향, 모든 구매 후보/상품 종류는 아직 검증하지 않았습니다.**
- `publicPlaceChatSupportsImageAndFollowUp`의 선택 라이브 테스트는 구 UI의 영역 확인 문구를 아직 참조합니다. 새 명시적 사진 질문 흐름에 맞게 갱신해야 함.

## 바로 이어서 할 작업

1. Galaxy A15에서 권한 허용, 상품 터치 윤곽, 모두 분석, 장시간 화면 공유, 네트워크 전환과 배터리 영향을 실기기 검증합니다.
2. Android Play App Signing용 release/upload 키와 Windows Authenticode 인증서를 준비합니다. 현재 APK는 debug 인증서, Windows 파일은 `NotSigned` 상태입니다.
3. 공개 중계 서버의 메모리 제한을 분산 사용자·기기·IP 쿼터로 교체하고 비용·오류 모니터링을 연결합니다.
4. 쿠팡 파트너스 등 정식 제휴 승인을 받은 뒤 일반 검색 링크를 수익 링크로 전환합니다. 승인 전에는 제휴 수익이라고 표시하지 않습니다.

## 환경과 빌드

- 원래 경로: `C:\Users\first2000\practice-board`. 새 경로에 맞게 조정합니다. 개인 로컬 SDK/JDK/에뮬레이터와 Android `local.properties`는 이전 ZIP에서 제외했습니다.
- 프로젝트: `cleantouch-android` (Gradle wrapper 포함), Java 17, Android compile/target SDK 36, build-tools 35.0.0, minimum API 26.
- Android Studio에서 프로젝트를 열어 필요한 SDK와 Java를 설치/지정하고 `local.properties`를 새 PC에 맞춰 생성합니다.
- 에뮬레이터 개발 검증: `gradlew.bat :app:assembleDebug :app:assembleDebugAndroidTest :app:testDebugUnitTest -PCLEANTOUCH_EMULATOR -PCLEANTOUCH_TESTING --console=plain`
- 기본 ARM 배포 후보: `gradlew.bat :app:assembleDebug --console=plain`. `CLEANTOUCH_EMULATOR`나 `CLEANTOUCH_TESTING` 없이 빌드하면 ARM, 난독화, 일반 설치용 debug 서명이 적용됩니다. 정식 스토어 release 서명은 별도 준비가 필요합니다.
- 공개 AI URL: `https://cleantouch-place-ai-20261006.netlify.app/v1/place-chat`. 기존 중계가 운영자 키를 가지고 있으며 소비자 앱에 키 입력 화면을 추가하지 않습니다.
- Netlify 새 배포는 이전에 Forbidden이 있었으므로 성공하지 않은 배포를 성공이라고 말하지 않습니다. 현재 공개 서비스를 그대로 사용합니다.
- PC/API 빌드는 각 폴더 README와 HANDOFF.md를 참고합니다. 새 PC에서 의존성은 다시 설치합니다.

## 보안과 작업 범위

- ZIP에 `.env`, 로그인 쿠키/토큰, API 키, keystore, 사용자의 캡처/대화 JSON, 설치된 앱 데이터, SDK/캐시/node_modules/빌드 산출물은 포함하지 않았습니다.
- `scripts/serve-cleantouch-downloads.mjs`는 모바일 작업 전부터 있던 수정으로 보관은 하지만 이번 모바일 작업의 변경으로 커밋하지 않습니다.
- 루트의 `frontend`, `backend`, `presentation`, 임시 패치 스크립트 등 무관한 미추적 작업은 이 CleanTouch 이전 파일에 포함하지 않았습니다.
- 대화 원문과 Orca 자체 UI/터미널/session DB를 그대로 이식하는 패키지가 아닙니다. 이 문서+최신 소스 기반으로 새 대화에서 이어갑니다.
