# onair-ingestion — 계획 (AC tree)

> 작성: 2026-06-28 / 단계: plan / 선행 = spec.md
> 진실 우선순위: 라이브 온에어 시트(enometa OAuth 추출본 research/onair-snapshot/) + 라이브 Supabase(seeding-ops 14,110협업) + 코드. 비파괴(additive·손실0)가 전 AC 불변 제약. 마이그 정본 = db/migrations/ = supabase/migrations/.

## AC Tree

- [x] **AC-1**: 마이그레이션 0013 — content_pieces·collaborations 확장 (additive) [spec §3-5]
  - [x] **AC-1.1**: `0013_onair_fields.sql` 신설 — content_pieces에 `reposts integer`·`quotes integer`·`concept text`·`content_type text`·`views_d1 integer`·`views_d3 integer`·`views_d7 integer`·`source_system text`·`external_ref text` add column if not exists. external_ref 부분 unique 인덱스(NULL 허용).
  - [x] **AC-1.2**: 같은 파일에 collaborations `campaign_label text`·`partnership_code text`·`currency text` add column if not exists. `db/migrations/`·`supabase/migrations/`(타임스탬프 명명) 양쪽 동일.
- [x] **AC-2**: `lib/types.ts` 신규 필드 타입 반영 [spec §3-5, 빌드정합]
  - [x] **AC-2.1**: `ContentPiece` 인터페이스 신설 또는 확장(reposts·quotes·concept·contentType·viewsD1/D3/D7·sourceSystem·externalRef 옵셔널). Collaboration에 `campaignLabel?`·`partnershipCode?`·`currency?` 추가.
- [x] **AC-3**: `scripts/etl_onair.py` 신설 — 추출·파싱·정규화·creators [spec §3-1·2·3]
  - [x] **AC-3.1**: enometa OAuth(token refresh) 읽기 + 국가 온에어 5탭(KR/CN/JP/TW/SG)+드랍/홀드 union 파싱. 탭별 헤더행 동적탐지(비어있지 않은 셀 최다 행), EN/KO 헤더→canonical 컬럼 매핑 테이블, 국가=탭 결정. CN 6×메트릭 블록은 마지막 비어있지 않은 블록 채택(execute에서 CSV 실측 확정). 소켓 타임아웃·페이싱·백오프.
  - [x] **AC-3.2**: 전 행 출처 태깅 — `source_system='onair_2026'`·`external_ref='onair:{gid}:{row}'`·`source_sheet_id`·`source_tab(gid)`·`source_row`.
  - [x] **AC-3.3**: creators upsert (handle,platform) ON CONFLICT — 온에어 메타(name·followers·tier·country·manager·avg_views·email) 정본 갱신. handle=계정URL→handle 또는 Name.
- [x] **AC-4**: collaborations 적재 — legacy 승격 dedup + 손실0 [spec §3-4]
  - [x] **AC-4.1**: (handle,platform) 매칭 — 기존 행 있으면 onair_2026으로 승격(status·content_fee_krw·cpv·invoice_no·listed/last_contact/scheduled/upload 날짜·campaign_label 갱신), 없으면 신규 insert. 이중계상 0(중복 insert 금지).
  - [x] **AC-4.2**: 손실0 계약 — blanket DELETE/TRUNCATE 0. 인앱 편집 보존: 해당 collab의 collaboration_status_history에 `changed_by != 'system'` 전이가 있으면 status 갱신 skip. status_history append-only 불변. 미일치 legacy 14k frozen.
- [x] **AC-5**: content_pieces 적재 — 성과·1/3/7일차 [spec §3-6]
  - [x] **AC-5.1**: 온에어 행→content_pieces(1협업 N콘텐츠): post_url·original_url·posted_at(완료일)·scheduled_post_date(예정일)·content_type·concept·제품(category)·views·likes·comments·reposts·saves·shares·views_d1/d3/d7. source_system·external_ref 태깅.
  - [x] **AC-5.2**: 정제·멱등 — "ERROR: …"·"#REF!"·"-"·빈칸을 null로. 멱등키 = external_ref(onair:{gid}:{row}:c) ON CONFLICT DO UPDATE. 업로드 전(링크 없음) 행은 scheduled만 보유하거나 미생성(execute 판단).
- [x] **AC-6**: 드랍/홀드 탭 반영 [spec §3-7]
  - [x] **AC-6.1**: 드랍/홀드 탭 파싱 → 해당 협업 status를 Drop/(홀드 매핑) effie 정본으로. 인앱 편집 보존 규칙(AC-4.2) 동일 적용. 홀드 status 매핑은 execute에서 탭 status 컬럼 실측 확정.
- [x] **AC-7**: Campaign 텍스트 보존 [spec §3-8]
  - [x] **AC-7.1**: 온에어 Campaign 값을 collaborations.campaign_label에 보존(승격·insert 양쪽). campaigns 테이블 1차시민화 안 함, 기존 Gifted/Paid/Affiliate 매핑 유지.
- [x] **AC-8**: reconcile 확장 [spec §3-9]
  - [x] **AC-8.1**: `scripts/reconcile.py`에 온에어 검증 추가 — onair_2026 협업 수, content_pieces 적재 수·1/3/7일차 채움률, source_system 분포, content_pieces PII 컬럼 0, 에러문자열 잔존 0. PASS/FAIL.
  - [x] **AC-8.2**: 손실0 재실행 검증 — etl_onair 2회 실행 전후 collaborations·creators·content_pieces·status_history 행수 멱등(신규분 외 ±0)·인앱편집 status 보존·legacy frozen 행수 불변을 스냅샷 비교로.
- [x] **AC-9**: 라이브 적용·검증 (안전 게이트) [spec §5·7]
  - [x] **AC-9.1**: 적용 전 스냅샷 → 마이그 0013 push → etl_onair 실행 → 2회차 재실행 → reconcile ALL PASS. Phase1 build·tsc·lint·vitest 통과.

## 메타

| AC | 의존 | 파일 영역 | 크기 |
|---|---|---|---|
| AC-1.1 | (없음) | `db/migrations/0013_onair_fields.sql`(+supabase/) | 작음 |
| AC-1.2 | AC-1.1 | `db/migrations/0013_onair_fields.sql` | 작음 |
| AC-2.1 | (없음) | `lib/types.ts` | 작음 |
| AC-3.1 | (없음) | `scripts/etl_onair.py` | 큼 |
| AC-3.2 | AC-3.1 | `scripts/etl_onair.py` | 작음 |
| AC-3.3 | AC-3.1·1.1 | `scripts/etl_onair.py` | 중간 |
| AC-4.1 | AC-3.3 | `scripts/etl_onair.py` | 큼 |
| AC-4.2 | AC-4.1 | `scripts/etl_onair.py` | 중간 |
| AC-5.1 | AC-4.1·1.1 | `scripts/etl_onair.py` | 큼 |
| AC-5.2 | AC-5.1 | `scripts/etl_onair.py` | 중간 |
| AC-6.1 | AC-4.1 | `scripts/etl_onair.py` | 중간 |
| AC-7.1 | AC-4.1 | `scripts/etl_onair.py` | 작음 |
| AC-8.1 | AC-5.1 | `scripts/reconcile.py` | 중간 |
| AC-8.2 | AC-4.2 | `scripts/reconcile.py` | 중간 |
| AC-9.1 | (전부) | 라이브 DB·CI | 중간 |

> 의존성 사이클 0. `scripts/etl_onair.py`(AC-3·4·5·6·7)는 한 파일이라 순차(메인 직접). 마이그 0013(AC-1)·types(AC-2)·reconcile(AC-8)은 별 파일이라 분리 가능. 병렬 안전 구간: AC-1·AC-2는 동시 가능(다른 파일).

## 실행 가이드 (/enometa-execute 참조)

- **메인 Claude 직접 권장**: 토대 스프린트와 동일하게 etl_onair.py가 한 파일에 집중되고 라이브 DB 안전·CSV 정밀 매핑이 핵심이라, 컨텍스트 보유한 메인이 직접 순차 처리(합성에이전트 스톨 전례·CSV 실측 필요).
- 작은·독립: 마이그 0013·types.ts·status-style 무관.
- 큰 AC(AC-3.1·4.1·5.1): execute 착수 시 5탭 헤더 CSV 실측(research/onair-snapshot/)으로 컬럼 매핑 테이블·1/3/7일차 의미·CN 블록·드랍홀드 status 먼저 확정한 뒤 구현.
- **안전 게이트(CLAUDE.md §3·손실0)**: AC-9.1 = 적용 전후 스냅샷·reconcile 2회 비교 동반. blanket DELETE/TRUNCATE·승격 이중계상·인앱편집 덮어쓰기 검출 시 즉시 중단.
- 외부 의존 0(온에어 접근 해결). 권장 순서: 0013·types → etl_onair(파싱→creators→collab 승격→content_pieces→드랍홀드→campaign_label) → reconcile 확장 → 라이브 적용·2회 검증.
