# shipping-completion — 계획 (AC tree)

> 작성: 2026-06-28 / 단계: plan / 선행 = spec.md
> 진실 우선순위: 라이브 Supabase(shipments 371·collaborations tracking 416) + 국내 송장 스냅샷(research/ship-snapshot/, PII·gitignore) + 코드. 비파괴(additive·손실0)·PII 제외가 전 AC 불변 제약. 마이그레이션 없음(기존 shipments 스키마 재사용).

## AC Tree

- [x] **AC-1**: 국내 송장 적재 — etl_shipments.py 확장 [spec §3-1·2·3]
  - [x] **AC-1.1**: 국내 시트(gid 1579019407) 추가 소스 — 헤더 이름 매핑(글로벌 고정인덱스와 구조 상이): invoice_no=송장번호·carrier=택배사·processed_date=송장입력일(실측)·country_code='KR'·source_sheet_id/source_row 태깅. 합포 중복은 invoice_no PK first-wins dedup.
  - [x] **AC-1.2**: PII 제외 — 수령자주소·우편번호·주문자이름·전화 컬럼 미적재(글로벌 규칙 동일). fee_krw=명시 배송비 컬럼 있을 때만(없으면 null, 상품원가 위장 금지). weight_g 동일.
  - [x] **AC-1.3**: carrier 국내 택배사 정규화 — norm_carrier에 국내 라벨(실측: "전체택배" 등) 추가.
- [x] **AC-2**: 송장↔협업 매칭 [spec §3-4·5]
  - [x] **AC-2.1**: collaborations.tracking_number 정제(strip·shipments.invoice_no에 실재하는 값만 조인 — 12자리/오염 자연 필터) → 일치 시 collaborations.invoice_no=송장(FK), shipments.match_status='matched'. 글로벌+국내. 손실0: invoice_no·match_status만 갱신, status·기타 불변.
- [x] **AC-3**: reconcile 확장 [spec §3-6]
  - [x] **AC-3.1**: scripts/reconcile.py에 — 국내 적재수(country=KR)·매칭수(글로벌+국내)·collaborations.invoice_no 채움·shipments.match_status 분포·shipments PII 컬럼 0·재실행 멱등(행수·status_history 불변). PASS/FAIL.
- [x] **AC-4**: 라이브 적용·검증 (안전 게이트) [spec §5·7]
  - [x] **AC-4.1**: 스냅샷 → etl_shipments(국내 적재) → 매칭 실행 → 2회차 재실행(멱등) → reconcile ALL PASS. Phase1 build·tsc·lint·test 통과.

## 메타

| AC | 의존 | 파일 영역 | 크기 |
|---|---|---|---|
| AC-1.1 | (없음) | `scripts/etl_shipments.py` | 큼 |
| AC-1.2 | AC-1.1 | `scripts/etl_shipments.py` | 작음 |
| AC-1.3 | AC-1.1 | `scripts/etl_shipments.py` | 작음 |
| AC-2.1 | AC-1.1 | `scripts/etl_shipments.py`(또는 매칭 단계) | 중간 |
| AC-3.1 | AC-2.1 | `scripts/reconcile.py` | 중간 |
| AC-4.1 | (전부) | 라이브 DB·CI | 중간 |

> 의존성 사이클 0. etl_shipments.py 한 파일 집중(AC-1·2) → 순차(메인 직접). reconcile(AC-3) 별 파일. 매칭(AC-2)은 적재(AC-1) 후 — 국내 송장이 shipments에 있어야 tracking이 FK로 붙음.

## 실행 가이드 (/enometa-execute 참조)

- **메인 Claude 직접 순차**: onair-ingestion·etl_shipments와 동일 — 한 파일 집중·라이브 안전·CSV 실측 매핑. 합성에이전트 스톨 회피.
- 착수 시 라이브 실측: 국내 CSV 헤더로 fee/weight/processed_date 매핑·carrier 라벨·합포 중복 패턴 확정(§8 오픈항목) 후 구현.
- **안전 게이트(CLAUDE.md §3·손실0)**: AC-4.1 = 스냅샷·reconcile 2회 비교. blanket DELETE/TRUNCATE·PII 적재·매칭 오연결(FK 무결성) 검출 시 즉시 중단.
- 권장 순서: AC-1(국내 적재·PII제외·carrier) → AC-2(매칭) → AC-3(reconcile) → AC-4(라이브 2회 검증).
- 외부 의존 0(국내 시트 로컬 스냅샷).
