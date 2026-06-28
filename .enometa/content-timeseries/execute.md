# content-timeseries — 실행 로그

> 작성: 2026-06-28 22:40 / 단계: execute / 선행 = plan.md
> 디스패치: 메인 직접 순차. 라이브 additive·멱등.

## 사전 정찰 (라벨 매핑 확정 — 누적값 대조 + bytes 디코드)
- 블롭 형식: "라벨: 숫자\n…"(콤마 허용). "ERROR:"·빈값은 숫자 매칭 안 돼 자연 skip.
- **라벨→canonical**(bytes 디코드+의미): 재생/조회→views · 좋아요→likes · 댓글→comments · 북마크/저장→saves · 리포스트→reposts · 공유→shares · 인용→quotes · 팔로우→follows.
- 누적 근사 검증: 재생↔views 63회·좋아요↔likes 76회·댓글↔comments 77회 근사(saves/quotes 누적 비어 오매칭은 의미 매핑으로 교정).
- 적재 대상(마이그): views/likes/comments _d1/d3/d7(채움 많음). saves·reposts·shares·quotes·follows는 파싱하되 raw 유지(spec §6).

## 실행 진행

전 AC 메인 직접 순차. 라이브 additive·멱등.

### AC-1 — metrics 순수 파서 (완료)
- lib/metrics.ts: parseMetrics + LABEL_MAP(재생/조회→views·좋아요→likes·댓글→comments·북마크/저장→saves·리포스트→reposts·공유→shares·인용→quotes·팔로우→follows). "라벨: 숫자" 정규식, ERROR/빈/미인식→부재(날조 0).
- lib/__tests__/metrics.test.ts 7건. 전체 36 passed.

### AC-2 — 마이그 0016 (완료)
- content_pieces views/likes/comments _d1/d3/d7 (9 int, additive). raw text 유지. db/+supabase/ 동기. supabase db push 적용.

### AC-3 — etl_onair 파싱 적재 (완료)
- parse_metrics(파이썬, lib/metrics LABEL_MAP 동일). cp_payload에 views/likes/comments _d1/d3/d7 정수 추가. raw 보존·external_ref 멱등.
- 적재: likes_d1 340·comments_d1 340·views_d1 82·views_d3 109·views_d7 3(플랫폼별 조회 라벨 차이로 views 부분, 날조 0이라 없으면 null).

### AC-4 — analytics 추이 (완료)
- lib/analytics: AnalyticsRecord에 9필드, aggregate에 timeseries(d1/d3/d7 중앙값·n, country 필터). lib/queries select·매핑 추가.
- page.tsx: "Growth · day 1/3/7" 섹션 — views/likes/comments 3열, d1/d3/d7 막대·중앙값·n. 데이터 없으면 "No scraped data". 영어 UI.

### AC-5 — reconcile (완료)
- 파싱 채움(likes_d1 raw 대비 ≥300 게이트·views_d1/d3 정보) 추가.

### AC-6 — 라이브 검증 (완료)
- 마이그 0016 push → etl 파싱 적재 → 2회 멱등 → reconcile ALL PASS. tsc 0·test 36·lint 0err·build 0·py_compile.
- 추이 sanity: 조회 중앙값 d1 813→d3 1001(증가 합리적). 멱등 전 테이블 불변·PII 0.

## 종료
전 8 leaf 완료. 다음 = /enometa-verify content-timeseries.
