# 상품 정확도 평가

`npm run build` 후 다음을 실행한다.

```
node scripts/evaluate-products.mjs truth.json predictions.json report.json --strict
```

정답 JSON의 `cases`는 `id`, 동일 원본 그룹 `groupId`, `split`(development/holdout), 상품군 `category`, 실제 정답 존재 여부 `targetPresent`, 허용 정답 SKU/상세 링크 `expectedProductIds`, `conditions` 배열을 가진다. `test/fixtures/quality-ground-truth.json`은 실제 사진의 **개발용 통제 사례 2개**다. 상품군 이름은 평가용 라벨이며 앱이 인식 가능한 상품의 화이트리스트가 아니다.

예측 JSON의 `predictions`는 `caseId`, `status`(ok/error), 반환한 `productIds` 배열을 가진다. 사진만 비슷한 상품을 동일 상품 정답 ID로 바꾸지 않는다. 판매 페이지/옵션 ID는 사람의 검토나 권한 있는 상품 자료로 확정해야 한다.

- precision: 반환한 ID 중 정답 ID 비율.
- recall: 정답이 있는 사례 중 정답을 반환한 사례 비율. 누락·분석 오류도 놓친 사례에 포함한다.
- negativeFalsePositiveRate: 정답이 없는 사례에서 다른 상품을 반환한 비율.
- errorRate: 분석 오류 또는 예측 파일에 결과가 없는 비율.
- abstentionRate: 정상 처리했으나 후보를 제시하지 않은 비율. 오류와 구분한다.

상품군·흐림·가림·색상 차이 등 조건별로 따로 집계한다. 분모가 0이면 null이며 100%로 만들지 않는다. 같은 원본의 사진·시간 인접 프레임·색 보정·크롭 변형에는 동일한 groupId를 부여해야 하며, 같은 groupId가 개발/평가 양쪽에 들어가면 거절한다. 원본 그룹 지정은 사람의 검토가 필요하며 사진의 유사도를 자동 판별하는 기능은 아니다. 정답과 예측의 중복도 거절한다. 개발용 결과는 배포 품질 통과로 사용하지 않는다.

초기 내부 통과 조건은 독립 holdout의 정답 존재 30개+미포함 30개, 5개 상품군, 20개 원본 그룹 이상이다. 충분한 자료일 때 precision≥95%, recall≥80%, 정답 미포함 오표시 0, 오류≤5%를 요구한다. 이 수치는 내부 시작 기준이며 통계적 보증이나 업계 표준이 아니다. 표본별 원본 검토와 지속적인 기준 보정이 필요하다.

현재 저장된 실증은 후보 URL을 평가자가 제공한 사진 비교 2건뿐이다. 자동 검색·실제 영상·가림·조명·다양한 기기 전체 성능을 검증하지 않았다. 보고서 `artifacts/verification/quality-holdout.json`은 **insufficient_data**이며 상용 품질 통과 상태가 아니다.

`task: identification`인 별도 정답 파일은 `expectedProductIds` 대신 `expectedLabels`를 사용해 종류·색상 인식만 평가한다. 이것을 SKU나 구매처 정확도와 섞지 않는다. 실제 검증에서 잘린 광선검 사진을 칫솔로 분류한 사례를 `identification-ground-truth.json`과 `quality-recognition-errors.json`에 실패로 남겼다. 허용 표현은 평가자가 정하며, 앱 내부의 상품 목록이 아니다. 원본 장면을 포함한 요청은 별도로 관찰했으나 같은 원본 한 사례의 결과를 일반 정확도 향상 수치로 주장하지 않는다.
