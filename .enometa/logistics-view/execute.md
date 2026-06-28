# logistics-view — 실행 로그

> 작성: 2026-06-29 / 단계: execute / 선행 = plan.md
> 디스패치: 메인 직접 순차(analytics-layer 동형·읽기 전용).

## 사전 정찰 (라이브 실측)
- country None 91 = 전부 brand_tag H&H(글로벌·fee 있음 88) → "H&H" 라벨(country 미상 아님, 타브랜드).
- 매칭: 송장 278/769=36%(국내 적재 후·미매칭 12자리 tracking 다수), 협업 282.
- delivery_status: 출고373·None312·취소29·반품24·반환중19·대기7(한글, 영어 매핑 + None=Unknown).
- 글로벌 물류비 2,536,000(글로벌만)·국내 fee null. feeExclHH(H&H 제외) 분리.

## 실행 진행

전 AC 메인 직접 순차. 읽기 전용.

### AC-1 — 물류 집계·쿼리·테스트 (완료)
- lib/logistics.ts: aggregateLogistics 순수 함수 — byCountry(None→brand_tag 정직)·byCarrier(+fee)·byStatus(statusLabel 한→영·None=Unknown)·글로벌 fee 합(국내 null 미합산)·feeExclHH·domesticFeeMissing 플래그·매칭 송장. lib/queries fetchLogistics(shipments 769 + collaborations invoice_no count). lib/__tests__/logistics.test.ts 7건.

### AC-2~6 — 화면 (완료)
- app/logistics/page.tsx: 요약 카드 4(발송·매칭률·글로벌 물류비·국내 미수집 "—")·By destination(국가/H&H)·By carrier(+fee)·Delivery status·Collaboration matching(matched/unmatched·정직 캡션). 영어 UI. NavTabs Logistics 탭.

### AC-7 — 검증 (완료)
- tsc 0·test 43(logistics 7)·lint 0err·build 0(/logistics 생성). DB 쓰기·마이그 0.
- 라이브 집계 정합: byCountry 합 769·matched 278·feeGlobal 2,536,000·feeExclHH 2,495,760. None country 91=H&H 정직 표기.

## 종료
전 AC 완료. 다음 = /enometa-verify logistics-view.
