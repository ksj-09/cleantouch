# CleanTouch 웹 시제품

실행: 프로젝트 루트에서 npm.cmd run dev:cleantouch.
주소: http://127.0.0.1:5180

## 현재 흐름

1. 앱 안의 원형 OFF 버튼 → 체험 시작.
2. ON 상태는 직접 끌 때까지 유지됩니다.
3. 기기 바깥의 **다른 앱을 보는 상황 체험**을 누르면 영상만 재생됩니다. 플로팅 버튼은 없습니다.
4. **CleanTouch 앱으로 돌아가기** → 원형 ON 버튼으로 종료.
5. 별도 분석 버튼 없이 분석 화면과 전체 상품 목록이 자동으로 나타납니다.
6. 상품명 검색·카테고리 필터·새 스캔을 사용할 수 있습니다.

웹은 실제 화면을 녹화하거나 인식하지 않는 조작 시제품입니다. 예시 가방·재킷·신발을 사용하며 결과에도 예시임을 표시합니다. 실제 녹화와 분석은 cleantouch-android에서 구현합니다.

## 검증

- npm.cmd run build --prefix cleantouch
- node scripts/check-cleantouch-toggle.mjs (서버가 5180에서 실행 중이어야 하며 .local/browser-check의 Playwright 사용)

기존 SDK·스튜디오는 /studio.html과 /partner.html에 유지합니다.
