# logistics-view — 계획 (AC tree)

> 작성: 2026-06-29 / 단계: plan / 선행 = spec.md
> 진실 우선순위: 라이브 shipments 769·collaborations.invoice_no 282 + 코드. 읽기 전용·정직 표기(null 투명)·집계 정합이 불변 제약. 집계는 순수 함수로 분리(테스트 가능).

## AC Tree

- [x] **AC-1**: 물류 집계 — 순수 함수 + 쿼리 [spec §3-7]
  - [x] **AC-1.1**: `lib/logistics.ts` 순수 집계 — shipments 평면 배열 → byCountry·byCarrier·byStatus(None 투명)·글로벌 물류비 합(국내 fee null 미합산)·글로벌/국내 수·매칭 송장 수. country None은 brand_tag와 구분("Unknown"). 테스트 가능.
  - [x] **AC-1.2**: `lib/queries.ts` `fetchLogistics()` — shipments 전체(769<1000) + collaborations.invoice_no 채움 수(매칭 협업) 조회 → AC-1.1 집계 호출. env 없으면 목 폴백.
  - [x] **AC-1.3**: `lib/__tests__/logistics.test.ts` — 집계 합=총수·국내 fee null 미합산·None 투명·매칭 수 케이스.
- [x] **AC-2**: `/logistics` 라우트·탭 [spec §3-1]
  - [x] **AC-2.1**: `app/logistics/page.tsx` 서버 컴포넌트(force-dynamic) + `fetchLogistics`. NavTabs "Logistics" 탭 추가.
- [x] **AC-3**: 요약 카드 [spec §3-2]
  - [x] **AC-3.1**: 총 발송·매칭(송장 278/협업 282)·글로벌 물류비(국내 미수집 캡션)·배송 진행. 정직 캡션.
- [x] **AC-4**: 국가별·택배사별 [spec §3-3·4]
  - [x] **AC-4.1**: country별 송장(None=Unknown 투명)·carrier별 송장·물류비(있는 것만). 막대/표. 합=769.
- [x] **AC-5**: 배송 상태 [spec §3-5]
  - [x] **AC-5.1**: delivery_status 분포(출고·취소·반품·반환중·None). 막대.
- [x] **AC-6**: 매칭 현황 [spec §3-6]
  - [x] **AC-6.1**: 매칭 송장(278/769)·협업 연결(282)·미매칭 투명. 매칭률 정직(데이터 한계 캡션).
- [x] **AC-7**: 검증 게이트 [spec §5·7]
  - [x] **AC-7.1**: build·tsc·lint·test 통과. 집계 합=769·매칭=DB matched 대조. DB 쓰기·마이그 0.

## 메타

| AC | 의존 | 파일 영역 | 크기 |
|---|---|---|---|
| AC-1.1 | (없음) | `lib/logistics.ts`(신설) | 중간 |
| AC-1.2 | AC-1.1 | `lib/queries.ts` | 작음 |
| AC-1.3 | AC-1.1 | `lib/__tests__/logistics.test.ts` | 작음 |
| AC-2.1 | AC-1.2 | `app/logistics/page.tsx`·`components/NavTabs.tsx` | 중간 |
| AC-3.1~6.1 | AC-2.1 | `app/logistics/page.tsx` | 작음 |
| AC-7.1 | (전부) | CI·라이브 | 작음 |

> 사이클 0. AC-1(집계·쿼리·테스트) → AC-2(화면) → AC-3~6(섹션) → AC-7. analytics-layer와 동형(순수집계+화면).

## 실행 가이드 (/enometa-execute 참조)
- **메인 직접 순차**: analytics-layer와 동형. 집계 순수 함수 분리·라이브 대조.
- 착수 시 라이브 실측: None country(91)가 brand_tag H&H인지 구분, 매칭률 분모 정의(송장 vs 협업) 확정.
- **안전(읽기 전용)**: DB 쓰기·마이그 0. SELECT만. 정직 표기(국내 fee null·매칭률 투명) 유지.
- 권장 순서: AC-1(집계+테스트) → AC-2(라우트·탭) → AC-3~6(카드·국가·carrier·상태·매칭) → AC-7.
