# CleanTouch Search API

안드로이드 앱에서 잘라낸 상품 이미지를 받아 웹상의 동일·유사 이미지를 찾는 검색 서버입니다.

0.3 앱은 녹화를 종료한 뒤 전체 장면 이미지를 차례로 보냅니다. `focus` 없는 요청에서 Groq/Gemini는 한 장면의 여러 상품을 인식하고, `products: [{ id, label, matches, box? }]`를 반환합니다. `box`는 전체 장면 기준 0~1의 [left, top, right, bottom] 좌표입니다. 기존 `matches`는 호환용 전체 링크 목록으로 유지합니다. 상품 수는 링크 수가 아니라 `products.length`입니다. Google Web Detection 공급자는 기존 단일 후보 결과를 감싸 반환합니다.

## 로컬 실행

```powershell
copy .env.example .env
npm.cmd install
npm.cmd run dev
```

기본 주소는 `http://127.0.0.1:8790`입니다.

## 권장 공급자: Gemini 3.5 Flash-Lite

CleanTouch의 기본 권장 모델은 `gemini-3.5-flash-lite`입니다. 여러 상품의 특징과 영역 좌표를 한 장면에서 받아 기존 Android 결과 형식으로 변환합니다. [공식 모델 목록](https://ai.google.dev/gemini-api/docs/models)

`.env`의 `GEMINI_API_KEY`에 [Google AI Studio에서 발급한 키](https://aistudio.google.com/apikey)를 저장합니다. 키는 서버에서만 읽으며 HTTP 인증 헤더로 전달합니다.

```env
SEARCH_PROVIDER=gemini
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_API_KEY=your-api-key
```

연결 검증은 `npm.cmd run check:gemini`입니다. 이 명령은 서버를 빌드한 뒤 `.env`의 `GEMINI_MODEL`에 설정된 모델(없으면 기본 Gemini 3.5 Flash-Lite)에 테스트 이미지 한 장을 보냅니다. 성공한 결과만 `artifacts/recognition-tests/gemini-latest-response.json`에 저장하고, 키가 비어 있으면 외부 요청 없이 종료합니다.

`GET /health`의 `provider`, `model`로 실제 실행 중인 공급자와 모델을 확인할 수 있습니다. `providerConfigured`는 키 설정 여부이며 키의 유효성이나 잔여 한도까지 보증하지 않습니다.

2026-09-28 현재: Gemini 3.8 Flash는 테스트 이미지 요청에서 HTTP 503을 반환했지만, 같은 서버 키로 Gemini 3.5 Flash-Lite는 HTTP 200과 상품 후보 2개를 반환했습니다. 로컬 `.env`도 `gemini-3.5-flash-lite`를 사용하며 키는 서버에만 저장됩니다. Gemini의 일시적 5xx 응답은 서버에서 한 번만 지연 재시도하고, 계속 실패하거나 긴 `Retry-After`를 받으면 안전한 `503 / PROVIDER_UNAVAILABLE` 응답을 Android에 반환합니다. 사용자의 실제 영상과 전체 장면 분석은 별도로 확인해야 합니다.

## Google Cloud Vision Web Detection 대체 공급자

이 설정은 `.env`에서 `SEARCH_PROVIDER=google`을 선택한 경우에만 필요합니다. Gemini Developer API는 `.env`의 `GEMINI_API_KEY`를 사용하며, Vision API 활성화나 서비스 계정 JSON이 필요하지 않습니다.

1. Google Cloud 프로젝트에서 Vision API를 활성화합니다.
2. 로컬에서는 서비스 계정 JSON 파일을 준비합니다.
3. `.env`에 프로젝트 ID와 JSON 파일의 절대 경로를 설정합니다.

```env
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=C:\secure\cleantouch-service-account.json
```

Cloud Run, GKE, Compute Engine에서는 JSON 키 파일을 넣지 않고 실행 서비스 계정에 Vision API 사용 권한을 부여하는 방식이 권장됩니다.

## API

### `GET /health`

서버와 검색 공급자 설정 상태를 반환합니다.

### `POST /v1/scans`

`multipart/form-data`의 `image` 필드로 JPEG, PNG 또는 WebP 이미지를 전송합니다. 선택적으로 `focus` 필드에 상품 영역을 잘라낸 이미지를 함께 보내면 작은 상품을 더 크게 분석합니다.

- 최대 파일 크기: 8MB
- 최대 입력 픽셀: 3천만
- 서버 전처리 크기: 최대 1280×1280
- 요청 이미지 디스크 저장: 없음
- 요청 제한: 기본 분당 30회

응답 예시:

```json
{
  "scanId": "request-id",
  "queryLabel": "black shoulder bag",
  "matches": [
    {
      "id": "8f73a1c0e0c81234",
      "title": "Black leather shoulder bag",
      "source": "shop.example",
      "url": "https://shop.example/products/123",
      "imageUrl": "https://images.example/123.jpg",
      "matchKind": "exact_image"
    }
  ],
  "retention": {
    "imageStored": false
  }
}
```

`exact_image`는 동일한 이미지가 웹에서 발견됐다는 뜻이며 동일한 실물 상품임을 보증하지 않습니다. `partial_image`는 부분 또는 유사 이미지입니다.
`search_link`는 이미지가 동일하다는 뜻이 아니라, AI가 확인한 상품 설명으로 쇼핑몰 검색을 여는 링크입니다. 가격·판매처는 링크를 연 시점의 쇼핑몰 결과에서 확인합니다.

### AI 사용량 제한

Groq의 429 응답은 공급자가 안내한 `Retry-After`를 보존해 반환합니다. Gemini의 429는 `Retry-After`와 `google.rpc.RetryInfo.retryDelay` 중 더 긴 대기를 사용하고, `QuotaFailure`의 한도 식별자로 분당/일일 제한을 구분합니다. 오류 본문의 `retryAfterSeconds`는 대기 초, `limitWindow`는 확인 가능한 `minute`, `day`, 또는 `unknown`입니다. 대기 시간이 제공되지 않으면 `retryAfterSeconds`는 생략합니다. 계정 식별자가 포함될 수 있는 공급자 원문 오류는 공개하지 않습니다.

모든 429를 무료 요금제 소진으로 해석하지 않습니다. Android 0.3.2는 429를 기존처럼 구분해 처리하고, Gemini 503은 서버의 제한된 재시도 후 녹화와 완료 결과를 보존한 채 이어서 분석할 수 있게 합니다. Google은 503을 일시적 과부하 또는 서비스 중단으로 분류합니다. [Gemini 오류 코드](https://ai.google.dev/gemini-api/docs/api-errors), [Gemini 재시도 안내](https://ai.google.dev/gemini-api/docs/troubleshooting), [Groq 한도 안내](https://console.groq.com/docs/rate-limits)

## 컨테이너

```powershell
docker build -t cleantouch-search-api .
docker run --rm -p 8790:8790 --env-file .env cleantouch-search-api
```

## 운영 전에 필요한 항목

- Cloud Armor, API Gateway 또는 별도 게이트웨이의 사용자 인증과 앱 무결성 검사
- 여러 서버에서 공유되는 Redis 기반 요청 제한
- 구조화 로그, 오류 추적, 지연 시간과 외부 API 실패율 모니터링
- 쇼핑몰 상품 피드와 가격·재고 동기화
- 판매처 URL 허용 목록과 악성 링크 검사
- 개인정보 처리방침과 이미지 처리 고지
- 지역별 데이터 처리 위치와 보존 정책

현재 Cloud Vision Web Detection은 웹에서 이미지가 사용된 페이지를 찾습니다. 정확한 상품명·가격·재고를 제공하려면 제휴 쇼핑몰의 상품 카탈로그와 이미지 벡터 검색을 추가해야 합니다.

Gemini가 반환한 상품 영역(`box`)이 있으면 서버는 해당 부분을 잘라 Cloud Vision Web Detection으로 실제 이미지 일치 페이지를 찾을 수 있습니다. 서버의 `.env`에 `GOOGLE_VISION_API_KEY`를 지정하거나 `GOOGLE_CLOUD_PROJECT`와 Application Default Credentials를 설정하면 활성화됩니다. 일치 페이지는 `exact_image`/`partial_image`로 문자 검색 링크보다 먼저 반환됩니다. 키가 없거나 Vision 검색에 실패하면 기존 문자 검색 링크를 유지합니다. 한 장면에서 최대 세 상품 영역만 조회합니다. 이 키는 서버에만 두며 앱에 넣지 않습니다. 웹에서 같은 이미지를 찾는 것과 같은 판매 상품을 찾는 것은 다르므로, 정확한 상품 검색에는 쇼핑몰 상품 카탈로그가 필요합니다.

Cloud Vision 프로젝트의 결제가 비활성화돼 있다면 요청이 403 `BILLING_DISABLED`로 실패합니다. 이 경우 `.env`의 `VISUAL_SEARCH_ENABLED=false`로 이미지 조회를 끄고 문자 검색만 제공하세요. 결제 연결과 테스트가 끝나면 `true`로 바꾸고 서버를 재시작합니다.
