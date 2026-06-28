# content-timeseries — 명세 (9칸)

> 작성: 2026-06-28 / Slug: content-timeseries / 단계: spec
> 근거: analytics-layer spec §6(제외했던 metrics 파싱)·effie 06-26 요구(1/3/7일차 추이) · 선행 onair-ingestion(metrics_d1/d3/d7 raw text 보존) · 라이브 실측(블롭 파싱 가능·라벨 8종·채움 d1 340) · BP bp-data-pipeline-observability·bp-ecommerce-analytics-dashboard. 자율 위임(데이터 기반).

## 1. 목표

온에어 content_pieces에 raw text로 보존된 1·3·7일차 성과 블롭(metrics_d1/d3/d7)을 **정수로 파싱·적재**하고, analytics 화면에 **콘텐츠 성과 추이(조회수가 1일→3일→7일 어떻게 성장하나)**를 시각화한다. 한 문장: *"콘텐츠가 올라간 뒤 조회수·반응이 시간에 따라 어떻게 자라는가"를 raw 스크랩 블롭에서 숫자로 뽑아 추이로 보여준다.*

## 2. 배경

onair-ingestion은 1/3/7일차 메트릭을 Bright Data 스크랩 raw 텍스트("좋아요: 3\n댓글: 50\n조회: 109293" 형식·"ERROR:" 다수)로 metrics_d1/d3/d7(text)에 보존만 했다(파싱은 후속으로 명시). analytics-layer는 누적 메트릭(views·likes 등)만 썼다. 이제 그 블롭을 파싱한다 — 라이브 실측 결과 라벨 8종(조회 559·좋아요 850·댓글 850·북마크 517·저장 194·리포스트 132·팔로우 74·공유 58)이 "라벨: 숫자" 형식으로 추출 가능하고, 채움은 d1 340·d3 307·d7 203(총 645)이다. 조회(views)는 누적 views와 근사해 매핑이 확인된다(행 예: d1 조회 109293 ↔ views 120516).

effie는 1/3/7일차 추이를 요구했다(06-26). 추이 = 콘텐츠 발행 후 성장 곡선으로, 어떤 콘텐츠가 늦게도 자라는지(롱테일) 판단의 근거다.

## 3. 핵심 요구사항

1. **`lib/metrics.ts` 순수 파서 신설** — metrics 블롭(text) → 정수 dict. "라벨: 숫자"(콤마 포함) 정규식 추출, 라벨을 canonical 필드(views·likes·comments·saves·reposts·shares·follows)로 매핑(한글 라벨 기반). "ERROR:"·"#REF!"·빈값은 무시(날조 0 — 못 뽑으면 null). 테스트 가능한 순수 함수.
2. **마이그레이션 — content_pieces 1/3/7일차 정수 컬럼(additive)** — `views_d1/d3/d7`·`likes_d1/d3/d7`·`comments_d1/d3/d7` integer add column if not exists. raw text(metrics_d1/d3/d7)는 유지(원본 보존). `db/migrations/`=`supabase/migrations/` 동기.
3. **etl_onair 파싱 적재** — content_pieces 적재 시 metrics_d1/d3/d7 블롭을 `lib/metrics` 규칙(파이썬 포팅 또는 동일 로직)으로 파싱해 정수 컬럼에 적재. raw text도 계속 보존. external_ref 멱등 유지. 파싱 실패(ERROR·빈값)는 null.
4. **analytics 추이 표시** — /analytics에 1/3/7일차 조회수 추이를 추가. 콘텐츠 발행 후 d1→d3→d7 평균 조회수(또는 중앙값) 성장을 막대/선으로. 데이터 있는 콘텐츠만(n 투명 표기). views가 핵심, likes/comments는 가능 시.
5. **손실0·멱등·날조 0** — 마이그 additive. etl 재실행 시 행수·status_history 불변, 파싱은 멱등(같은 블롭→같은 정수). 파싱 안 되는 라벨·ERROR는 null(0이나 추정으로 안 채움).
6. **reconcile·테스트** — reconcile에 파싱 채움률(views_d1 등 non-null 수)·정합 추가. lib/metrics 파서 단위 테스트(정상 블롭·ERROR·빈값·콤마·다라벨).

## 4. 제약 조건

- **날조 0(절대선)** — 파싱 안 되는 블롭("ERROR:"·"#REF!"·빈값·미인식 라벨)은 null. 0이나 누적값으로 메우지 않는다. 추이 표시는 데이터 있는 콘텐츠만·n 투명 표기.
- **비파괴·additive·손실0** — 정수 컬럼 add column만. raw text metrics_d1/d3/d7 유지(원본 보존). DELETE/TRUNCATE 0. etl 재실행 멱등.
- **PII 0** — metrics 블롭은 성과 숫자만(PII 없음). 신규 컬럼·커밋에 PII 0.
- **단순함** — lib/metrics 순수 함수 1개 + 파이썬 동일 로직. 새 라이브러리 0. analytics 추이는 기존 CSS bar 재사용.
- **운영 영어** — analytics UI 영어.

## 5. 성공 기준

1. lib/metrics 파서가 "라벨: 숫자" 블롭을 정수 dict로 변환(views·likes·comments 최소), ERROR/빈값→null. 단위 테스트 통과.
2. 마이그 후 content_pieces에 views_d1/d3/d7 등 정수 적재(채움 d1 ≈340 수준), raw text 유지.
3. etl_onair 2회 실행 멱등(행수·status_history 불변, 파싱 정수 동일).
4. /analytics에 1/3/7일차 조회수 추이 표시(데이터 있는 것만·n 표기). build·tsc·lint·test 통과, reconcile ALL PASS.
5. 파싱 안 되는 블롭은 null(0/추정 0), PII 0.

## 6. 제외할 것

- **likes/comments 외 라벨(북마크·저장·리포스트·팔로우·공유) 전체 컬럼화** — 채움 적은 라벨은 후속. 본 스프린트는 views_d1/d3/d7 핵심 + likes/comments_d1/d3/d7(채움 많음). 나머지는 raw text에 남김.
- **인게이지먼트% 추이·성장률 계산 지표** — 추이 원천(정수)만. 파생 지표는 후속.
- **campaigns·통화·물류** — 무관.
- **d7 이후·커스텀 기간** — 시트가 1/3/7일차만 제공.

## 7. 검증 방법

- **Phase 1(결정론)**: build·tsc·lint·test 통과. 마이그 push 에러 0.
- **Phase 2(의미·정합)**: (a) lib/metrics 파서가 실측 블롭 샘플을 정확히 파싱(조회=views 근사 확인), (b) etl 적재 후 views_d1 채움 ≈340, (c) 2회 멱등, (d) ERROR/빈값 null, (e) raw text 유지·PII 0. + BP(bp-data-pipeline-observability 멱등·provenance / bp-ecommerce-analytics-dashboard 추이 시각화 3-1·3-3).
- **Phase 3(적대적)**: 격리 검토자가 "파싱 실패를 0/추정으로 메우지 않나(날조)", "재실행이 raw text·다른 데이터를 안 지우나", "라벨 매핑이 틀려 조회를 좋아요로 넣지 않나", "additive 외 파괴 DDL 없나", "PII 없나"를 판정.

## 8. 추가로 AI가 질문해야 할 것

- **라벨 정확 매핑**: 라이브 라벨 8종(터미널 깨짐)의 정확한 한글 → canonical 매핑을 execute에서 코드 내 바이트 비교로 확정. 조회→views는 누적 views 근사로 검증. 좋아요→likes·댓글→comments는 누적값 대조. 북마크/저장은 saves로 합칠지 execute 판단.
- **추이 집계 단위**: d1/d3/d7 평균 vs 중앙값(조회수 분포 치우침) — 중앙값 권장(이상치 둔감), execute에서 분포 보고 확정. 또는 둘 다.
- **파싱 멱등**: 같은 raw 블롭은 같은 정수 → external_ref upsert 시 정수 컬럼 갱신. 멱등 보장.
- **lib/metrics(TS) ↔ 파이썬 파서 일치**: 두 곳에 같은 로직 — 한쪽이 정본(TS 테스트)이고 파이썬은 동일 규칙 포팅. 라벨 매핑 테이블 일치 확인.

## 9. Research 요약

- **이름**: analytics-layer spec(제외 항목)·effie 요구 / **경로**: `.enometa/analytics-layer/spec.md` §6·research/05 §G(D1-4 추이) / **핵심 1줄**: 1/3/7일차 추이는 analytics 후속으로 명시, metrics raw text 파싱이 전제. / **시사점**: 요구 1·4 근거.
- **이름**: 라이브 블롭 실측 / **경로**: 본 spec §2(라벨 8종·채움 d1 340·조회 559·형식 "라벨: 숫자") / **핵심 1줄**: 블롭 파싱 가능·조회=views 근사 매핑 확인. / **시사점**: 요구 1·성공기준 근거.
- **이름**: 선행 onair-ingestion / **경로**: `scripts/etl_onair.py`(metrics_d1/d3/d7 raw 보존·external_ref 멱등)·`.enometa/onair-ingestion/` / **핵심 1줄**: raw text 보존·후속 파싱 명시, 멱등 upsert 패턴. / **시사점**: 요구 3·5 — 파싱을 멱등 적재에 얹기.
- **이름**: BP ecommerce-analytics-dashboard / **경로**: `~/.claude/skills/enometa-shared/references/bp-ecommerce-analytics-dashboard.md` / **핵심 1줄**: 시계열 가로축·0기준·비교 동반(원칙 3-1·3-3). / **시사점**: 요구 4 추이 시각화.
- **이름**: BP 데이터 파이프라인 Observability / **경로**: `~/.claude/skills/enometa-shared/references/bp-data-pipeline-observability.md` / **핵심 1줄**: 멱등·provenance·파싱 정합. / **시사점**: 요구 5·6.
