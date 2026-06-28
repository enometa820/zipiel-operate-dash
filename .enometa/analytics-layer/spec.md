# analytics-layer — 명세 (9칸)

> 작성: 2026-06-28 / Slug: analytics-layer / 단계: spec
> 근거: research/05 §B·§E·§G(시트 성과분석 재현 설계·화면 매핑·D1-1~4)·effie 코퍼스(C0BDVHVNBPS) · 선행 onair-ingestion(content_pieces 645 적재 완료) · BP bp-ecommerce-analytics-dashboard. 사용자 결정 2건(2026-06-28): 스코프 D1-1~4 전부 · 화면 = 요약 카드 + 시트 매트릭스.

## 1. 목표

온에어 시트에서 적재한 콘텐츠 성과 데이터(content_pieces 645·onair_2026 협업 789)를 **분석 화면(`/analytics`)으로 시각화**한다. effie가 쓰던 성과분석 시트(일/주/월·국가×제품 매트릭스)를 재현하되, 상단에 핵심 요약 카드를 얹는다. 한 문장: *대표·매니저가 "이번 달 얼마나 발행했고, 예정 대비 얼마나 달성했고, 콘텐츠 반응이 어떤가"를 한 화면에서 일/주/월로 보는 분석 탭을 만든다.*

## 2. 배경

onair-ingestion 스프린트로 성과 분석의 원천 데이터가 적재됐다: content_pieces 645건(완료일 93%·예정일 84%·제품 카테고리 96%·조회수 46%), onair_2026 협업 789(국가는 creators.country). effie 요구의 절반은 이미 시트의 "성과분석 탭"(일별 555754910·주차별·월별·컨셉별)에 매트릭스로 존재한다(research/05 §B3·B4) — 국가(KR/CN/JP/TW/SG)×제품(Serum/Cream/Clay/all)×콘텐츠수, 일자별 + 달성률·평균 인게이지먼트. 이 시트 구조를 화면으로 재현하는 게 본 스프린트다. 데이터층은 끝났고(D-15·D-16), 남은 건 표현층이다. campaigns 1차시민화·역산 달성률(D1-5)·통화/비용 롤업(D1-6/7)은 다음 스프린트로 분리한다.

BP(bp-ecommerce-analytics-dashboard)의 정합: 요약을 1급으로 얹고 익숙한 시트 세분화를 드릴다운에 보존(원칙 1-1·1-5 Jakob's Law), 같은 데이터를 일/주/월로 토글(2-1), 달성률은 예정 대비 비교로 제시(3-1), 매트릭스는 테이블·추세는 막대(6-1).

## 3. 핵심 요구사항

1. **`/analytics` 라우트 + NavTabs 탭 신설** — 일/주/월(day/week/month) grain 토글. 운영 언어 영어 UI(라벨 영어, status·handoff만 한글).
2. **요약 카드(상단 1급, BP 1-1)** — 선택 기간 기준: 총 발행 콘텐츠 수(completed), 달성률(예정 대비 완료 %), 평균 인게이지먼트%(조회수 있는 콘텐츠만, n 표기), 활성 국가 수. 각 지표는 비교 맥락(전기간 또는 예정 대비)을 동반(BP 3-1).
3. **시트 매트릭스 재현(D1-1, BP 1-5)** — 행=기간(일/주/월 grain), 열=국가×제품(Country × Serum/Cream/Clay/all), 값=콘텐츠 발행 수. effie 성과분석(일별) 시트 구조 답습. 복합 제품("Cream; Clay")·"all"은 정규화 규칙으로 집계(§8에서 확정).
4. **달성률(D1-2, BP 3-1)** — 예정(scheduled_post_date) 대비 완료(posted_at) 비율을 grain별·국가별로. 분모=예정 건수, 분자=완료 건수. 분모 0이면 "—" 표기(날조 금지).
5. **국가×제품·국가×티어 발행수(D1-3)** — 발행된 콘텐츠를 국가×제품, 협업을 국가×티어(creators.tier)로 집계해 막대/표로.
6. **인게이지먼트%(D1-4)** — `(likes+comments+reposts+saves+shares)/views`, **조회수 있는 콘텐츠만** 계산. 화면에 "조회수 수집 n/총 m" 투명 표기(데이터 46% 한계, BP feedback-dashboard 빈/부분 상태). views=0/null은 분모에서 제외.
7. **쿼리 함수 신설(`lib/queries.ts`)** — `fetchContentMatrix({grain, country?, product?})`·`fetchAchievementRate({grain})`·`fetchEngagementStats({grain})`. content_pieces → collaboration → creator(country·tier) PostgREST embed 조인(기존 `creator:creators(country)` 패턴 재사용). 서버 집계, env 없으면 목 폴백 정합.
8. **차트·표 컴포넌트** — 차트 라이브러리 미도입(심플함): 기존 CSS bar(status/page.tsx Bars 패턴)·HTML 테이블·필요시 inline SVG. 매트릭스=테이블(BP 6-1 정확값=테이블), 추세=막대. 색은 범주 구분·접근성(BP 6-2, 기존 PHASE 색 토큰 재사용).
9. **빈/이상 상태·단위 테스트** — 데이터 없는 기간·조회수 없는 콘텐츠를 명시 처리(빈 상태 카피). 집계 함수(매트릭스 합·달성률·인게이지먼트) vitest 단위 테스트.

## 4. 제약 조건

- **읽기 전용 화면 — DB 변경 0.** 마이그레이션·적재 없음. 기존 content_pieces·collaborations·creators를 조회·집계만. (campaigns 컬럼 추가가 필요한 역산 달성률은 D1-5로 분리)
- **날조 0(절대선).** 조회수 미수집(54%)·예정일 없음을 추정값으로 채우지 않는다. 계산 가능한 모수만 쓰고 n/m을 투명 표기. 분모 0은 "—".
- **차트 라이브러리 도입 최소화.** recharts 등 미설치 상태 유지 — 기존 CSS bar·테이블·inline SVG로. 도입은 가치가 단점을 넘을 때만(현재는 불요).
- **운영 언어 영어.** /analytics UI 카피는 영어. 한글은 status·handoff 탭 한정.
- **성능.** content_pieces 645·협업 789 규모 — 서버 집계(서버 컴포넌트), 필요시 캐시. 기존 fetchStats 병렬·최소컬럼 패턴 답습.
- **데이터 진실 우선순위.** 라이브 DB·시트 스냅샷 > 문서. 매트릭스 합은 content_pieces 실제 수와 대조.

## 5. 성공 기준

1. `/analytics` 탭에서 일/주/월 토글로 매트릭스(국가×제품 콘텐츠수)·달성률·인게이지먼트%·요약 카드가 라이브 데이터로 표시된다.
2. 매트릭스가 시트 성과분석(일별) 구조(행=기간, 열=국가×제품, 값=콘텐츠수)를 재현하고, 매트릭스 총합이 해당 기간 content_pieces 발행 수와 일치한다.
3. 달성률 = 예정 대비 완료(%), 분모 0은 "—". 인게이지먼트% = engagement/views(조회수 있는 것만), "n/m 수집" 투명 표기.
4. 마이그레이션·DB 쓰기 0(읽기 전용). build·`npx tsc --noEmit`·lint·`npm test`(vitest) 통과.
5. UI 카피 영어. 집계 함수(매트릭스·달성률·인게이지먼트) 단위 테스트 통과. 빈 기간·조회수 없는 콘텐츠가 깨지지 않고 명시 처리.
6. BP 체크리스트(bp-ecommerce-analytics-dashboard) 충족: 요약 1급·시트 세분화 답습·토글 피벗·비교 동반·차트 목적별·색 접근성.

## 6. 제외할 것

- **campaigns 1차시민화·역산 달성률(D1-5)** — 캠페인 target_count 기준 달성률은 campaigns 컬럼(brand×country×mode×target) 신설이 선행. 본 스프린트 달성률은 scheduled(예정) 기준만.
- **통화 환산·비용 롤업·채널 N분할(D1-6/7)** — 후속.
- **metrics_d1/d3/d7 시계열 파싱** — raw text 보존 상태. 1/3/7일차 추이 차트는 파싱 스프린트 후. 본 스프린트 인게이지먼트는 누적 메트릭(views·likes 등) 기준.
- **컨셉별 분석(성과분석 컨셉별 시트)** — concept 데이터 채움률 점검 후 후속(본 스프린트는 국가×제품 매트릭스 우선).
- **국내 배송 적재·송장 매칭(D0-6/7)**, **오프라인·에이전시(P2)**.

## 7. 검증 방법

- **Phase 1(결정론)**: `npm run build` + `npx tsc --noEmit` + `npm run lint` + `npm test`(vitest) 통과. DB 마이그 0(읽기 전용 확인).
- **Phase 2(의미·정합)**: (a) 매트릭스 총합 = 라이브 content_pieces 발행 수 대조, (b) 달성률 분자/분모가 posted/scheduled 실수치와 일치, (c) 인게이지먼트 분모가 views>0 건수(라이브 298 수준)와 일치·미수집 투명 표기, (d) 빈 기간·views 0 처리, (e) UI 영어. + BP 체크리스트(bp-ecommerce-analytics-dashboard 원칙 1-1·1-5·2-1·3-1·6-1·6-2).
- **Phase 3(적대적)**: 격리 검토자가 "추정·날조 수치가 섞이지 않나(미수집 조회수를 0이나 평균으로 채우지 않나)", "분모 0·views null에서 NaN/Infinity·깨짐 없나", "매트릭스 합이 실제와 어긋나지 않나", "DB 쓰기·마이그가 정말 0인가(읽기 전용 계약)", "운영 영어 위반 없나"를 코드·diff로 판정.

## 8. 추가로 AI가 질문해야 할 것

- **달성률 분모 정의**: 본 스프린트는 scheduled_post_date(예정일) 있는 콘텐츠를 분모로, posted_at(완료일) 있는 것을 분자로 잡는다(예정 대비 완료). 캠페인 목표건수 기준 역산은 D1-5(제외). — execute 착수 시 scheduled vs posted 교차표로 정의 확정.
- **복합 제품·"all" 매트릭스 처리**: category가 "Cream; Clay"(복합)·"all"인 행(라이브 ~70건)을 매트릭스에서 (1) 각 제품 열에 중복 카운트 (2) "Mixed/All" 별도 열 — 권장 = 별도 "All/Mixed" 열(중복 카운트는 합 불일치 유발). execute에서 CSV·라이브 분포로 확정.
- **주/월 경계**: posted_at 기준 grain 집계. 주=ISO week(월요일 시작) 권장, 월=KST 캘린더 월. execute에서 시트 주차 정의와 대조.
- **인게이지먼트 분모**: views>0만 분모. views null/0 행은 "조회수 미수집"으로 분리 카운트해 화면에 n/m 표기(분모에서 제외, 0으로 안 봄).

## 9. Research 요약

- **이름**: 원본 해석·백로그·시트재현 설계 / **경로**: `research/05-원본-해석-백로그-화면설계.md`(§B3·B4·E·G, D1-1~4) / **라이센스**: repo / **핵심 1줄**: 성과분석 시트(일/주/월·국가×제품 매트릭스·달성률·인게이지먼트%)를 /analytics로 재현, fetchContentMatrix·fetchAchievementRate 함수 설계. / **시사점**: 요구 1~7의 화면·함수·매핑 1차 근거.
- **이름**: BP ecommerce-analytics-dashboard / **경로**: `~/.claude/skills/enometa-shared/references/bp-ecommerce-analytics-dashboard.md` / **라이센스**: 내부 합성(NN/g·Stephen Few·IBCS·Looker 교차검증) / **핵심 1줄**: 요약 1급+점진공개, Jakob's Law로 기존 시트 세분화 답습, 토글·피벗>복제, 고립 절대값 금지(비교 동반), 차트 목적별·색 접근성. / **시사점**: 요구 2·3·4·8의 IA·시각화 원칙, verify Phase 2.5 체크리스트.
- **이름**: 기존 쿼리·집계 패턴 / **경로**: `lib/queries.ts`(fetchStats·fetchCollaborationViews의 `creator:creators(country)` embed 조인·byCountry 집계)·`app/status/page.tsx`(Bars·Stat CSS bar 컴포넌트) / **핵심 1줄**: PostgREST embed로 국가 조인, 서버 집계, CSS div bar 시각화(차트 라이브러리 미설치). / **시사점**: 요구 7·8 재사용 — 새 라이브러리 없이 기존 패턴 확장.
- **이름**: BP feedback-dashboard-coldstart / **경로**: `~/.claude/skills/enometa-shared/references/bp-feedback-dashboard-coldstart.md` / **핵심 1줄**: 빈/이상/부분 데이터 상태를 명시 처리, 행동 1~3개 유도. / **시사점**: 요구 6·9 — 조회수 미수집 54%·빈 기간의 투명 처리.
