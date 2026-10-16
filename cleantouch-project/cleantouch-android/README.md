# CleanTouch Android 0.4.7

0.4.7 runs Gemini identification alongside Lens for the selected product image. A short product name, visible evidence, and a Google Shopping button using that exact name appear above the Lens page. Uncertain types do not get a shopping query. **AI에게 상품 더 물어보기** opens the existing chatbot with the selected product and identification already loaded, without another crop or initial cloud request. Prices and stock require checking the seller. AI failures leave Lens available. The native Lens page now begins upload when the page becomes visible and retries one initial network loading failure.

0.4.6 adds **장소 분석 · AI 챗봇** to the floating menu and a recent-scene AI button to the main app. It opens a chat with “이 장소 분석해줘”, sends the chosen video crop to the public Netlify Gemini relay, and supports follow-up questions and map searches without an end-user API key. Returning to the video restores the widget and keeps the screen-sharing session alive.

Black letterbox boundaries can be cropped automatically. When arbitrary portrait app/video boundaries are uncertain, a local preview asks the user to confirm or drag the video bounds before any network upload. This is not universal video-region detection. No GPS is sent, locations are estimates, and the relay does not save image files. Internet and provider quotas apply. Instrumented emulator tests verify uncertain-frame confirmation, letterbox cropping, and real public-server image chat plus follow-up; Galaxy A15 hardware verification remains necessary.

0.4.4 limits the longest edge of the segmentation input to 512 pixels while preserving the original product crop resolution. GrabCut therefore also uses the bounded mask size. Cropping reads only the selected bounds instead of another full-screen pixel array. The floating service releases the segmentation model after each attempt and handles Java heap exhaustion without stopping capture; native crashes or Android process termination cannot be recovered by this handler. Galaxy A15 hardware verification remains necessary.

첫 화면에는 항상 원형 OFF/ON 버튼이 표시됩니다. 원을 눌러 Android 화면 공유와 위젯 권한을 허용한 뒤 유튜브·인스타그램 등으로 이동합니다.

- 위젯 → **현재 화면에서 상품 터치**: 보던 장면을 고정한 화면에서 상품을 한 번 누릅니다. 터치 이후 영상이 움직여 위치가 어긋나는 문제를 방지합니다. 지원되는 상품의 감지 영역을 먼저 찾고, MediaPipe MagicTouch로 윤곽을 추출합니다. 감지 영역이 없거나 해당 영역의 분할이 실패하면 전체 장면에서 터치 기반 추출을 시도합니다. 사진을 직접 저장·업로드할 필요가 없습니다.
- PC와 같은 적응형 기준으로 터치 지점 근처의 연결된 마스크만 남겨 초록색 윤곽선을 표시합니다. 실패하면 임의의 사각형을 저장하지 않고 같은 장면에서 다시 선택하도록 안내합니다. 선택 확인 카드의 **Google Lens에서 정보·구매처 찾기**를 누르면 배경을 제거한 선택 이미지를 Google에 전달합니다.
- OFF/ON 원형 버튼의 글씨와 아이콘은 흰색이며 준비 중에도 밝은 글씨를 유지합니다.
- 화면 버퍼는 실제 픽셀만 행별로 복사하며, 캡처 오류나 시간 초과가 나면 스캔을 유지하고 위젯을 복원합니다. 화면 선택 중에는 위젯 창을 잠시 숨깁니다. 캡처 해상도 상한은 1280입니다.
- 물건과 착용자가 함께 선택되는 경우를 줄이기 위해 주변 배경 지점을 모델에 전달하고, 터치한 부분과 화면 경계를 기준으로 OpenCV GrabCut 보정을 적용합니다. 화면 공유 프레임의 생성 시각도 확인해 위젯 메뉴가 남은 이전 프레임을 제외합니다.
- 스캔 중 약 3초마다 장면을 기기 내부에 보관합니다(최대 240장면, 저장 공간 부족 시 일시정지). 앱 자체 화면과 Lens 화면은 수집을 잠시 멈춥니다. 소리는 저장하지 않습니다.
- 앱의 **모두 분석**은 수집을 일시정지하고 보관한 장면에서 EfficientDet-Lite0로 지원되는 물건 후보를 찾습니다. 전체 장면을 처리하지만 모든 종류의 상품을 인식하는 모델은 아닙니다. 의류·광선검 같은 지원되지 않거나 놓친 물건은 지난 장면을 열어 직접 누를 수 있습니다.
- 유사한 색·형태의 반복 상품은 한 카드에 등장 시각을 합칩니다. 시점 변화가 크면 별도 카드가 남을 수 있고 동일 상품 판별을 보장하지 않습니다.
- 현재 앱의 시작/선택/모두 분석 경로에는 API 키나 별도 분석 서버가 필요 없습니다. Lens 검색과 판매처 이동에는 인터넷이 필요합니다. 기존 `RecordingAnalyzer`/`ScreenCaptureService`는 이전 녹화 코드이며 새 대시보드에서 실행하지 않습니다.

Lens는 WebView의 데스크톱 업로드 화면과 파일 선택 콜백으로 이미지를 전달한 뒤, 결과 페이지에서 모바일 화면으로 전환합니다. 위젯을 먼저 숨긴 후 백그라운드에서 Activity를 시작하지 않고, 표시 중인 선택 카드의 사용자 클릭으로 열어 Activity가 나타난 뒤 위젯을 숨깁니다. Google 웹사이트 변경이나 확인 화면에 따라 검색이 실패할 수 있습니다. 실패 안내와 재시도가 표시됩니다.

## 빌드와 검증

JDK 17 / Android SDK 36. 일반 APK에는 ARM64/ARMv7 라이브러리를 포함합니다. x86_64 에뮬레이터 검사는 -PCLEANTOUCH_EMULATOR를 추가해 네이티브 라이브러리로 실행합니다.

```powershell
.\gradlew.bat testDebugUnitTest lintDebug assembleDebug
.\gradlew.bat connectedDebugAndroidTest -PCLEANTOUCH_TESTING
# Google로 테스트용 사진을 실제 업로드하는 선택적 통합 테스트
.\gradlew.bat connectedDebugAndroidTest -PCLEANTOUCH_TESTING '-Pandroid.testInstrumentationRunnerArguments.lens=true'
```

`app/src/androidTest/assets/bag.png`는 기존 프로젝트의 테스트용 사진입니다. 기본 기기 테스트는 첫 화면, 실제 모델 마스킹, 전체 장면 분석과 중복 병합을 확인합니다. 네트워크 Lens 검사는 별도 옵션으로 실행합니다.

모델 출처:
- MagicTouch: 기존 `interactive_segmentation.task`.
- EfficientDet-Lite0 int8: https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/1/efficientdet_lite0.tflite
  SHA-256: `0720bf247bd76e6594ea28fa9c6f7c5242be774818997dbbeffc4da460c723bb`
- 공식 설명: https://developers.google.com/edge/mediapipe/solutions/vision/object_detector
- 경계 보정: OpenCV 4.13.0, https://docs.opencv.org/4.13.0/d8/d83/tutorial_py_grabcut.html

출력: `app/build/outputs/apk/debug/app-debug.apk`. 기존 debug 앱과 동일한 서명으로 업데이트 설치합니다. 실제 사용자 휴대폰의 회전·영상 앱·전원 관리 환경은 별도 확인해야 합니다.
