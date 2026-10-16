# CleanTouch 프로젝트

CleanTouch 전용 앱 소스와 관련 자료를 모아 둔 폴더입니다. 기존 `practice-board` 게시판은 이 폴더와 별도로 루트의 `frontend`와 `backend`에 있습니다.

## 구성

- `cleantouch-desktop`: Windows 앱
- `cleantouch-android`: Android 앱
- `cleantouch`: 웹 프로토타입과 SDK
- `cleantouch-search-api`: 상품·장소 분석 API
- `idea`, `presentation`: 기획 및 발표 자료
- `artifacts`: APK, 화면 검증 캡처, 배포 자료
- `scripts`: CleanTouch용 작업·검증 스크립트
- `HANDOFF.md`, `TRANSFER-HANDOFF.md`, `SECURITY.md`: 작업 인계와 보안 문서

이 폴더에서 다음 명령을 실행합니다.

```powershell
npm.cmd run build:windows
npm.cmd run test:search
npm.cmd run serve:downloads
```

Windows 앱 개별 설정은 `cleantouch-desktop`의 README를, Android SDK 설치와 빌드는 `scripts/setup-cleantouch-android.ps1`을 확인하세요.

## PPT 사업화 계획 실행

진행 상태와 검증 범위는 `PPT-IMPLEMENTATION.md`에 기록합니다. 첫 단계의 상품 연결 검증실은 `npm.cmd run pilot:catalogue` 실행 후 `http://127.0.0.1:8792`에서 확인할 수 있습니다. 가상 자료를 사용하는 로컬 개발 도구이며 기존 Windows/APK의 새 배포본이 아닙니다. 실제 상품 입력 형식은 `cleantouch-search-api/CATALOGUE-PILOT.md`를 참고하세요.

GitHub Actions는 저장소 루트의 `.github/workflows/cleantouch-windows-release.yml`에서 이 폴더를 대상으로 실행됩니다. 로컬 `.local`, `.netlify`, `node_modules`는 공용 개발 상태와 캐시라 이 폴더로 옮기지 않았습니다.
