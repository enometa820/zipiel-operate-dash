# onair-ingestion — 실행 로그

> 작성: 2026-06-28 / 단계: execute / 선행 = plan.md
> 디스패치: 메인 Claude 직접 순차(etl_onair.py 한 파일·CSV 실측 매핑·라이브 안전). 라이브 적용은 스냅샷 게이트 동반.

## 사전 정찰 (CSV 실측 — §8 오픈항목 확정)
- **컬럼 매핑 = 헤더 이름 기반**(고정 인덱스 X): 탭별 컬럼 위치/수 상이(KR 44·JP/TW/SG 43·CN 61·드랍홀드 37=협업브랜드·출처 삽입). row4(EN)+row5(KO) 헤더로 canonical 매핑. find_col 방식.
- **정본 메트릭 = 조회수·좋아요·댓글·리포스트·북마크·공유수**(KR idx 38-43, 깔끔한 숫자). content_pieces.views/likes/comments/reposts/saves/shares로.
- **1/3/7일차(idx 34-36) = Bright Data 스크랩 raw 텍스트 블롭**(다행·"ERROR: …" 다수, 깔끔 숫자 아님) → **text 컬럼(metrics_d1/d3/d7)으로 raw 보존**(integer 아님, 나중 파싱). spec §8 확정: views_d1/d3/d7 integer → metrics_d1/d3/d7 text로 보정.
- **CN 6×메트릭 블록**(38-43·45-50·51-56·57-62): 첫 블록(이름 첫 매칭) 채택, 잔여 블록은 로그(silent cap 금지).
- **드랍/홀드**: status=진행현황(col17). 분포 드랍23·협의중11·협업조건조율8·배송중7… 자유텍스트 협상블롭 다수. map_status(etl_seeding 재사용) 적용 — 드랍→Drop, 깔끔라벨→해당상태, 블롭→매칭없으면 현상태 유지. 협업브랜드 컬럼 존재.
- handle = 계정 URL(col8) regex 우선, 없으면 Name(col7). map_status·map_platform·to_int·to_date·normalize_manager = etl_seeding에서 재사용.

## 실행 진행

전 AC 메인 직접 순차. 라이브 적용은 스냅샷 게이트 동반.

### AC-1·2 — 마이그 0013 + types (완료)
- `0013_onair_fields.sql`(+supabase): content_pieces reposts·quotes·concept·content_type·metrics_d1/d3/d7(**text**, raw 보존)·source_system·external_ref / collaborations campaign_label·partnership_code·currency. lib/types.ts ContentPiece 신설 + Collaboration 확장.
- 실행 중 발견 갭 → 추가 마이그: **0014**(content_pieces.scheduled_post_date — 0001 부재, 달성률 분모) · **0015**(external_ref partial→full unique — PostgREST on_conflict이 partial 못 씀 42P10).

### AC-3 — etl_onair.py (완료)
- enometa OAuth(자동갱신) + 국가 5탭+드랍홀드. **헤더 이름 기반 매핑**(탭별 위치 상이 대응, EN+KO 결합 라벨). 출처태깅·creators upsert(in_legacy_list 미포함=legacy 표시 보존).

### AC-4 — collaborations 승격 dedup + 손실0 (완료)
- (handle,platform) legacy 일치→onair_2026 승격(이중계상 0), 미일치 insert, external_ref 멱등. DELETE/TRUNCATE 0. 인앱편집(이력보유) status skip.
- **알려진 한계(문서화)**: ETL 승격 status 변경→트리거 history(changed_by=manager)→재실행 시 protected 분류로 status 동결(320). 초기 적재 정상. 지속 재동기화는 app-vs-ETL 마커 필요(후속). 손실0·멱등 무영향.

### AC-5 — content_pieces (완료)
- 1협업 N콘텐츠(post_url/scheduled). 정본 메트릭=조회/좋아요/댓글/리포스트/북마크/공유, 1/3/7일차=raw text. 에러문자열 부분일치 정제→null. external_ref 멱등.

### AC-6·7 — 드랍홀드·campaign_label (완료)
- 드랍홀드 map_status(드랍→Drop, 블롭→현상태). campaign_label 보존.

### AC-8·9 — reconcile·라이브 (완료)
- reconcile 확장(onair·content_pieces·에러문자열·손실0). 라이브: 스냅샷→0013/14/15 push→etl_onair→재실행→**reconcile ALL PASS**.
- 결과: **온에어 협업 789**(JP272·CN234·KR197·TW86·SG0)·**content_pieces 645**·크리에이터 13,093. 손실0 멱등(전 행수 불변·편집 보존). tsc·lint·build·vitest 통과.

## 종료
전 24 leaf 완료. 다음 = /enometa-verify onair-ingestion.

## 실행 진행
