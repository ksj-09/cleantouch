# 상품 카탈로그 연결 검증실

PPT의 0~1단계 중 데이터 연결·정답 범위·SDK 호환 경로를 검증하는 도구다. 새로운 범용 상품 인식 AI나 상용 B2B 플랫폼이 아니다.

## 실행

```powershell
npm.cmd run pilot:catalogue
```

브라우저에서 `http://127.0.0.1:8792`에 접속한다. 최초에는 아무 자료도 연결되지 않는다. **테스트 자료 사용**은 가상 데이터만 불러오며, 구매 버튼을 만들지 않는다. 실제 JSON을 불러올 수도 있다. 파일은 이 실행의 메모리에만 보관되고 외부로 전송하거나 서버 파일로 저장하지 않는다. 종료하면 사라진다.

서비스는 `127.0.0.1`에만 바인딩한다. Host/Origin 검사, 페이지별 토큰, CSP, 요청 한도를 사용하지만 정식 로그인·멀티테넌트·과금 인증은 아니다. 인터넷 공개나 원격 프록시 배포용으로 사용하지 않는다.

## 자료 형식

전체 예시: `test/fixtures/catalogue-test.json`.

| 필드 | 의미 |
| --- | --- |
| `schemaVersion` | 현재 `1` |
| `dataClass` | `test` 가상 자료 / `merchant` 판매자 제공 자료. 값 자체가 사용권의 증거는 아님 |
| `tenantId` | 고객/자료 묶음의 고유 ID. 현재 실행에는 하나의 묶음만 연결 |
| `source` | 출처 ID, 사용 권한·계약 확인 기록의 참조, 갱신 시각 |
| `products` | 고유 상품 ID, 이름, 브랜드·모델·분류(알 수 없으면 생략), `variants` |
| `variants` | 고유 `sku`, 색·사이즈·GTIN(선택), `images`, `offers` |
| `images` | 사용 가능한 참조 사진의 공개 HTTPS URL. 현재 도구는 다운로드하거나 이미지 특징을 생성하지 않음 |
| `offers` | 검색 페이지가 아닌 상품 상세 URL, 국가(`KR`), 통화(`KRW`), 가격(미제공 시 생략), 재고, 확인 시각 |
| `contents` | 판매자가 등록한 영상 ID/이름, SKU별 노출 구간과 키프레임 |

`source.updatedAt`와 `offers.checkedAt`은 `2026-10-15T00:00:00Z`처럼 시간대를 포함한다. 키프레임 `{time,x,y,width,height}`의 위치·크기는 기존 SDK와 같이 0~100 퍼센트다. 선택 점의 API 입력은 0~1이다. 노출 구간은 기존 SDK와 같이 시작·종료를 모두 포함한다. 겹치는 태그는 자동으로 하나를 선택하지 않는다.

가격은 자료 값이며 최신 가격을 조회한 결과가 아니다. 24시간이 지난 재고 자료나 미래 시각의 자료는 재고 미확인으로 취급한다. SKU에 가격이 없으면 기존 SDK에서 0원으로 표시되지 않도록 SDK 변환 결과에서 제외하고 `omittedSkus`로 알린다.

## 판매자에게 요청할 자료

우선 한 업종/영상/상품 범위를 정한다. 실제 판매자의 상품·옵션 ID, 선명한 여러 방향의 참조 사진, 로고/모델/GTIN(있을 때), 실제 상세 URL, 국가별 가격/재고 갱신 방식, 이미지·데이터 사용 허가를 받는다. 고객의 연락처·주문자 데이터·로그인 비밀번호·API 키는 카탈로그에 넣지 않는다. 서류·계약은 별도 안전한 위치에서 관리하고 `permissionReference`에는 참조만 남긴다.

## 형식 검사와 연결 평가

```powershell
npm.cmd run catalogue:check
npm.cmd run catalogue:evaluate
# 빌드 후 실제 파일 경로를 명시하는 경우
node scripts/check-catalogue.mjs C:\safe\merchant-catalogue.json
node scripts/evaluate-catalogue.mjs C:\safe\merchant-catalogue.json C:\safe\contract-cases.json
```

기본 평가는 가상 상품 3개/옵션 4개와 11개 연결 케이스를 사용한다. `kind=catalogue_contract` 데이터셋에는 질문/등록 태그 입력과 정답 상태/SKU를 기록한다. 보고서에는 `doesNotMeasure`가 포함된다. 이 결과를 이미지 인식 정확도·정답 검색률·실판매 링크 최신성·구매 전환율로 사용하지 않는다.

## 기존 SDK 연결

로컬 화면의 **SDK 데이터 확인**은 `{contentId, products}` 구조를 반환한다. 상품 ID는 SKU이며 `productUrl`, `activeFrom`, `activeTo`, `keyframes`는 기존 `cleantouch/src/sdk/types.ts` 구조와 호환된다. `metadata.dataClass`와 검증 안내도 포함한다.

현재 로컬 `/v1/sdk`는 개발 화면의 보호된 POST 경로다. 기존 공개 SDK의 `dataUrl`에 바로 넣는 공개 GET API가 아니다. 이 단계에서는 어댑터 데이터만 검증했다. 이후 정식 고객 인증/권한과 자료 갱신 정책이 갖춰지면 SDK에 안전한 공개 읽기 경로를 연결한다.

## 다음 품질 측정

실제 이미지 + 정답 SKU/옵션 + 영상 ID + 평가 분할 + 정답 미포함 여부가 있는 평가셋이 필요하다. 우선 범용 시각 검색과 카탈로그 내 검색을 구분하고, Top-1/Top-5, 동일 상품 오표시율, 판별 보류율, 링크 유효성, p95 지연, 성공당 비용을 측정한다. 이미지/영상/SKU가 개발셋과 평가셋 양쪽에 중복되어 성능을 부풀리지 않게 한다.
