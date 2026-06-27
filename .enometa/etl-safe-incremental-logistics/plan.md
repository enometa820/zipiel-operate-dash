# etl-safe-incremental-logistics — 계획 (AC tree)

> 작성: 2026-06-26 / 단계: plan / 선행 = spec.md
> 진실 우선순위: 라이브 Supabase(seeding-ops, 협업 14,110·크리에이터 12,845) + 코드 정본. 마이그레이션 정본 = `db/migrations/` = `supabase/migrations/`. 비파괴(additive only)·손실 0이 전 AC의 불변 제약.

## AC Tree

- [x] **AC-1**: 상태 EN 라벨 정정 — `On Hold` → `Payment Pending` (의미·KO·페이즈는 이미 정확, EN만 교체)
  - [x] **AC-1.1**: 마이그레이션 `0006_payment_pending.sql` 신설 — `alter type collab_status rename value 'On Hold' to 'Payment Pending';` (기존 'On Hold' 값 행 자동 승계). `db/migrations/`·`supabase/migrations/` 양쪽에 동일 파일.
  - [x] **AC-1.2**: `lib/types.ts`에서 `'On Hold'` 5개 출현(Status 유니온 32·STATUS_KO 키 50·STATUSES 배열 69·STATUS_PHASE 키 163·PHASE_STATUSES Payment 184)을 `'Payment Pending'`으로 교체. STATUS_KO 값 `'지급 대기'` 유지.
  - [x] **AC-1.3**: `lib/status-style.ts`의 해당 상태 스타일 키 `'On Hold'` → `'Payment Pending'` 교체(색·한영 병기 유지).
  - [x] **AC-1.4**: `scripts/etl_seeding.py` `map_status` 테이블의 `("on hold","지급 대기",...)→"On Hold"` 행을 `→"Payment Pending"`으로 교체.
- [x] **AC-2**: 출처 태깅 컬럼 추가 (손실 없는 참조·증분 머지의 전제)
  - [x] **AC-2.1**: 마이그레이션 `0007_source_tagging.sql` — `collaborations`에 `source_system text`·`source_sheet_id text`·`source_tab text`·`source_row int`·`external_ref text` add column if not exists + `external_ref` 부분 unique 인덱스(NULL 허용) + `source_system` 인덱스.
  - [x] **AC-2.2**: `0007`에 `creators`의 `source_system text`·`in_legacy_list boolean not null default false` add column 포함.
  - [x] **AC-2.3**: `lib/types.ts` `Creator`·`Collaboration` 인터페이스에 `sourceSystem?`·`externalRef?`(Creator는 `inLegacyList?` 추가) 옵셔널 필드 추가.
- [x] **AC-3**: ETL을 전량삭제 → 손실 없는 멱등 upsert로 재설계 (`scripts/etl_seeding.py`)
  - [x] **AC-3.1**: blanket DELETE 제거 — `for t in [collaborations,creators,campaigns]: DELETE id=not.is.null`(224-227행) 삭제. `collaboration_status_history`·`content_pieces`·`payments`에 어떤 DELETE/TRUNCATE도 발행하지 않음.
  - [x] **AC-3.2**: 기존 14k legacy 백필 — creators·collaborations에 `source_system='legacy_contact_list'`·creators `in_legacy_list=true`·`external_ref`(안정 키 `legacy:{handle}:{platform}`) 부여. 1회 멱등(이미 태깅된 행 재실행 시 변경 0).
  - [x] **AC-3.3**: 멱등 upsert 로직 — creators는 `(handle,platform)` ON CONFLICT DO UPDATE(메타만), collaborations는 `external_ref` ON CONFLICT DO UPDATE. 재실행 시 행수 불변·중복 0.
  - [x] **AC-3.4**: 인앱 편집 보존 — collaborations upsert가 `status`를 덮어쓰지 않는 규칙(해당 collab의 `collaboration_status_history`에 `changed_by != 'system'` 전이가 있으면 status 갱신 skip). server action 편집이 ETL에 소실되지 않음.
- [x] **AC-4**: `products`(제품원가 COGS) 마스터 신설·시드
  - [x] **AC-4.1**: 마이그레이션 `0008_products.sql` — `products(id uuid pk, name text unique, sku text, cogs_krw numeric(12,2), aliases text[])` + 시드 `('세럼',2438,{serum})·('크림',2900,{cream})·('클레이',2618,{clay,마스크,mask})` `on conflict (name) do update`(멱등).
  - [x] **AC-4.2**: `lib/types.ts`에 `Product` 인터페이스 추가(id·name·sku?·cogsKrw·aliases).
- [x] **AC-5**: `shipments`(물류비·송장) 테이블 신설 + 배송 시트 적재
  - [x] **AC-5.1**: 마이그레이션 `0009_shipments.sql` — `shipments(invoice_no text pk, carrier text, request_date date, processed_date date, weight_g int, fee_krw numeric(12,2), country_code text, brand_tag text, customs_no text, delivery_status text, source_sheet_id text, source_row int, match_status text not null default 'unmatched')` + `collaborations.invoice_no text references shipments(invoice_no)` add column.
  - [x] **AC-5.2**: `scripts/etl_shipments.py` 신설 — 배송 CSV(scratchpad `ship-2081447250.csv`) → shipments upsert. 송장 dedup(제품 다행 반복 1회), carrier 라벨 정규화(K패킷·k 패킷·k패킷·K-Packet→K-Packet / 한중해상 / EMS / SeaExpress), 국가코드 칸의 'H&H'를 `brand_tag`로 분리. **PII(수취인명·전화·우편번호·주소) 컬럼 미적재.**
  - [x] **AC-5.3**: `lib/types.ts`에 `Shipment` 인터페이스 추가.
- [x] **AC-6**: 정합 검증(reconciliation) 산출 + 안전 스냅샷
  - [x] **AC-6.1**: `scripts/reconcile.py` 신설 — 출력: 배송 CSV 고유 송장 수 vs shipments 행수 일치 / 물류비 합(송장 dedup) 일치 / 전 행 source_system 채움률 100% / products 시드 확인 / 'On Hold' 잔존 0. PASS/FAIL 명시.
  - [x] **AC-6.2**: ETL 재실행 안전 검증 — 적용 전후 collaborations·creators·collaboration_status_history 행수와 임의 인앱편집 status 1건의 보존을 `reconcile.py`가 2회 실행 비교로 확인(±0·보존). (마이그레이션 적용 전 행수·status_history 카운트 스냅샷 기록.)
- [x] **AC-7**: 개발현황(`/status`) 최소 노출
  - [x] **AC-7.1**: `lib/queries.ts`에 shipments 건수·물류비 합(H&H 제외 기본)·products·source_system 분포 집계 함수 추가.
  - [x] **AC-7.2**: `/status` 페이지(app/status)에 위 수치를 한 줄씩 노출(shipments N건·물류비 합·products 3종·source 분포). 차트·시각화 없음(스코프 밖).

## 메타

| AC | 의존 | 파일 영역 | 크기 |
|---|---|---|---|
| AC-1.1 | (없음) | `db/migrations/0006_payment_pending.sql`(+supabase/) | 작음 |
| AC-1.2 | (없음) | `lib/types.ts` | 작음 |
| AC-1.3 | (없음) | `lib/status-style.ts` | 작음 |
| AC-1.4 | (없음) | `scripts/etl_seeding.py` | 작음 |
| AC-2.1 | (없음) | `db/migrations/0007_source_tagging.sql`(+supabase/) | 작음 |
| AC-2.2 | AC-2.1 | `db/migrations/0007_source_tagging.sql` | 작음 |
| AC-2.3 | (없음) | `lib/types.ts` | 작음 |
| AC-3.1 | AC-2.1·2.2 | `scripts/etl_seeding.py` | 작음 |
| AC-3.2 | AC-3.1 | `scripts/etl_seeding.py` | 중간 |
| AC-3.3 | AC-3.2 | `scripts/etl_seeding.py` | 큼 |
| AC-3.4 | AC-3.3 | `scripts/etl_seeding.py` | 중간 |
| AC-4.1 | (없음) | `db/migrations/0008_products.sql`(+supabase/) | 작음 |
| AC-4.2 | (없음) | `lib/types.ts` | 작음 |
| AC-5.1 | (없음) | `db/migrations/0009_shipments.sql`(+supabase/) | 중간 |
| AC-5.2 | AC-5.1·4.1 | `scripts/etl_shipments.py` | 큼 |
| AC-5.3 | (없음) | `lib/types.ts` | 작음 |
| AC-6.1 | AC-5.2·4.1 | `scripts/reconcile.py` | 중간 |
| AC-6.2 | AC-3.4 | `scripts/reconcile.py` | 중간 |
| AC-7.1 | AC-5.1·4.1·2.1 | `lib/queries.ts` | 중간 |
| AC-7.2 | AC-7.1 | `app/status/` | 중간 |

> 의존성 사이클 0. 병렬 안전 구간: 마이그레이션 4종(AC-1.1·2.1·4.1·5.1)은 서로 다른 파일이라 동시 작성 가능하나 라이브 적용은 순차(0006→0009). `lib/types.ts` 편집(AC-1.2·2.3·4.2·5.3)은 한 파일이라 한 번에 묶어 처리. `scripts/etl_seeding.py`(AC-3.x)·`etl_shipments.py`(AC-5.2)·`reconcile.py`(AC-6)는 별 파일이라 분리 가능.

## 실행 가이드 (/enometa-execute 참조)

- 작은·독립 AC = 메인 Claude 직접(마이그레이션 4종·types.ts 묶음·status-style·map_status).
- 큰 AC = subagent 디스패치 권장: AC-3.3(ETL upsert 코어 재작성)·AC-5.2(배송 적재).
- **안전 게이트(CLAUDE.md §3)**: 라이브 DB 마이그레이션 적용·ETL 재실행은 AC-6.2 스냅샷(전후 행수·status_history) 통과를 동반. blanket DELETE/TRUNCATE 재등장 시 즉시 중단.
- 권장 순서: 마이그레이션(0006~0009) 적용 → types/style 코드 동기화 → ETL 재설계(AC-3) → 배송·products 적재(AC-4·5) → reconcile(AC-6) → /status(AC-7).
- 외부 의존 0(배송 CSV·effie 명시 원가값 보유). 온에어 시트(401)는 본 스프린트 미사용.
