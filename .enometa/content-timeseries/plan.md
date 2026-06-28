# content-timeseries — 계획 (AC tree)

> 작성: 2026-06-28 / 단계: plan / 선행 = spec.md
> 진실 우선순위: 라이브 content_pieces(metrics_d1/d3/d7 raw blob) + 코드. additive·손실0·날조0(파싱 실패→null)이 불변 제약. 파서는 순수(lib/metrics.ts)로 테스트 가능, 파이썬 동일 로직 포팅.

## AC Tree

- [x] **AC-1**: metrics 순수 파서 + 테스트 [spec §3-1·6]
  - [x] **AC-1.1**: `lib/metrics.ts` 신설 — `parseMetrics(blob: string)` → `{views?,likes?,comments?,saves?,reposts?,shares?,follows?}`. "라벨: 숫자"(콤마 허용) 정규식, 한글 라벨→canonical 매핑 테이블. "ERROR"·"#REF"·빈값·미인식 라벨 무시(없으면 필드 부재=null). LABEL_MAP export(파이썬 일치 확인용).
  - [x] **AC-1.2**: `lib/__tests__/metrics.test.ts` — 정상 블롭(조회/좋아요/댓글)·ERROR·빈값·콤마 숫자·다라벨·미인식 라벨 케이스.
- [x] **AC-2**: 마이그 — content_pieces 1/3/7일차 정수 컬럼 [spec §3-2]
  - [x] **AC-2.1**: `0016_content_timeseries.sql` — `views_d1/d3/d7`·`likes_d1/d3/d7`·`comments_d1/d3/d7` integer add column if not exists. db/=supabase/ 동기. raw text 유지.
- [x] **AC-3**: etl_onair 파싱 적재 [spec §3-3]
  - [x] **AC-3.1**: etl_onair.py에 `parse_metrics(blob)` 추가(lib/metrics와 동일 라벨 매핑·규칙). content_pieces payload에 views_d1/d3/d7·likes_d1/d3/d7·comments_d1/d3/d7 정수 추가. raw text(metrics_d1/d3/d7) 계속 보존. external_ref 멱등.
- [x] **AC-4**: analytics 추이 표시 [spec §3-4]
  - [x] **AC-4.1**: lib/analytics aggregate에 timeseries 집계(d1/d3/d7 조회수 중앙값·평균, n) 추가. lib/queries fetchAnalytics 반영(content_pieces select에 신규 컬럼).
  - [x] **AC-4.2**: app/analytics/page.tsx에 "1/3/7-day view growth" 섹션 — d1→d3→d7 막대(데이터 있는 n 표기). 영어 UI.
- [x] **AC-5**: reconcile 채움률 [spec §3-6]
  - [x] **AC-5.1**: reconcile.py에 views_d1/d3/d7 non-null 채움률·정합(raw 있는데 파싱 0 아님) 추가.
- [x] **AC-6**: 라이브 적용·검증 [spec §5·7]
  - [x] **AC-6.1**: 마이그 0016 push → etl_onair 재실행(파싱 적재) → 2회 멱등 → reconcile ALL PASS. build·tsc·lint·test 통과.

## 메타

| AC | 의존 | 파일 영역 | 크기 |
|---|---|---|---|
| AC-1.1 | (없음) | `lib/metrics.ts`(신설) | 중간 |
| AC-1.2 | AC-1.1 | `lib/__tests__/metrics.test.ts` | 작음 |
| AC-2.1 | (없음) | `db/migrations/0016_*`(+supabase) | 작음 |
| AC-3.1 | AC-1.1·2.1 | `scripts/etl_onair.py` | 중간 |
| AC-4.1 | AC-2.1 | `lib/analytics.ts`·`lib/queries.ts` | 중간 |
| AC-4.2 | AC-4.1 | `app/analytics/page.tsx` | 작음 |
| AC-5.1 | AC-3.1 | `scripts/reconcile.py` | 작음 |
| AC-6.1 | (전부) | 라이브·CI | 중간 |

> 사이클 0. 핵심: AC-1(파서)·AC-2(마이그) 독립 → AC-3(etl 파싱)·AC-4(화면)는 그 후. 파이썬 파서(AC-3)는 TS 파서(AC-1) 라벨 매핑과 일치해야(정본=TS 테스트).

## 실행 가이드 (/enometa-execute 참조)
- **메인 직접 순차**: 라벨 매핑 정확성·라이브 안전 핵심.
- 착수 시 라이브 실측: 라벨 8종의 정확한 한글→canonical 매핑을 코드 내 바이트 비교로 확정(터미널 깨짐 회피). 조회=views를 누적 views 근사로 검증. 추이 집계 단위(중앙값 권장) 분포 보고 확정.
- **안전(손실0)**: 마이그 additive only. etl 재실행 멱등·raw text 보존. 파싱 실패 null(날조 0). 스냅샷·reconcile 2회.
- 권장 순서: AC-1(파서+테스트) → AC-2(마이그) → AC-3(etl 파싱) → AC-5(reconcile) → AC-4(화면) → AC-6(라이브 2회 검증).
