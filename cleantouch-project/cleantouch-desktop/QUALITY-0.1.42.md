# CleanTouch 0.1.42

- AI 대화의 `…` 메뉴에서 대화 복사, 화면 함께 보기, 사진 업로드와 개인정보 안내를 바로 실행합니다.
- 상품 카드에서 같은 정제 검색어로 네이버쇼핑, 쿠팡, 11번가, G마켓, Google 쇼핑을 비교합니다.
- URL·숨은 제어문자·명령문이 상품 검색어에 섞이지 않도록 전처리합니다.
- Windows에서 지원되는 경우 대화 기록을 현재 Windows 사용자 자격으로 암호화합니다. 기존 기록은 읽을 수 있고 다음 저장 때 암호화됩니다.
- 외부 링크와 클립보드 IPC의 형식·크기 검사를 유지합니다.

검증: 데스크톱 단위 테스트 95개, 검색 API 테스트 64개 통과.

현재 배포 후보의 Windows 실행 파일은 Authenticode 상용 인증서가 없어 Windows에서 `NotSigned`로 표시됩니다. Android APK는 기존 개발용 패키지 `kr.cleantouch.scan.debug`와 Android debug 인증서로 서명된 ARM 미리보기입니다. 공개 스토어 출시 전에는 별도의 Windows 코드 서명 인증서와 Android Play App Signing용 release/upload 키가 필요합니다.
