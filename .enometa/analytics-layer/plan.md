# analytics-layer — 계획 (AC tree)

> 작성: 2026-06-28 / 단계: plan / 선행 = spec.md
> 진실 우선순위: 라이브 Supabase(content_pieces 645·onair_2026 789·creators country/tier) + 시트 성과분석 구조(research/05) + 코드. 읽기 전용(DB 쓰기·마이그 0)이 전 AC 불변 제약. 집계 로직은 순수 함수(lib/analytics.ts)로 분리해 테스트 가능하게(기존 grid-filters 패턴).

## AC Tree

- [x] **AC-1**: 집계 로직·쿼리·타입 (데이터층, 표현층 선행) [spec §3-7]
  - [x] **AC-1.1**: `lib/types.ts` — `AnalyticsData`(grain·matrix·achievement·engagement·summary) + 하위 타입(MatrixRow·CountryProductCell·AchievementRow·EngagementStat) 추가.
  - [x] **AC-1.2**: `lib/analytics.ts` 신설 — 순수 집계 함수. 입력 = content_pieces+country+tier 평면 배열·grain, 출력 = AnalyticsData. (a) 매트릭스: 행=기간 버킷(day=날짜·week=ISO월요일·month=KST캘린더월), 열=국가×제품(Serum/Cream/Clay/all + 복합은 "Mixed" 열), 값=발행수(posted_at 기준). (b) 달성률: 분모=scheduled 건수·분자=posted 건수·grain·국가별, 분모0→null. (c) 인게이지먼트: views>0만 `(likes+comments+reposts+saves+shares)/views`, 수집 n·총 m 동반. (d) 요약: 총발행·달성률·평균인게이지먼트%·활성국가수 + 전기간 비교값.
  - [x] **AC-1.3**: `lib/queries.ts` — `fetchAnalytics({grain})` 신설. content_pieces → collaboration → creator(country·tier) PostgREST embed 조인으로 평면 로드(기존 `creator:creators(country)` 패턴) → AC-1.2 순수 함수 호출 → AnalyticsData 반환. env 없으면 `lib/data.ts` 목 폴백 정합.
- [x] **AC-2**: `/analytics` 라우트·탭·grain 토글 [spec §3-1]
  - [x] **AC-2.1**: `app/analytics/page.tsx` 신설 — 서버 컴포넌트(`force-dynamic`), `searchParams.grain`(기본 month) 읽어 `fetchAnalytics` 호출. 레이아웃 = 요약 카드(상단) + 매트릭스 + 달성률/국가 + 인게이지먼트(하단), max-w 일관(status/handoff 패턴).
  - [x] **AC-2.2**: `components/NavTabs.tsx` — "Analytics" 탭 추가(영어, 운영 UI 규칙).
  - [x] **AC-2.3**: grain 토글 UI — day/week/month를 `?grain=` Link로 전환(클라이언트 상태 불요·서버 재집계). 활성 표시.
- [x] **AC-3**: 요약 카드 (BP 1-1 요약 1급) [spec §3-2]
  - [x] **AC-3.1**: 선택 기간 총 발행·달성률(%)·평균 인게이지먼트%(n/m)·활성 국가 수 카드. 각 카드에 비교 맥락(전기간 또는 예정 대비, BP 3-1). Stat 컴포넌트 패턴 재사용.
- [x] **AC-4**: 시트 매트릭스 테이블 (BP 1-5 Jakob's Law) [spec §3-3]
  - [x] **AC-4.1**: 행=기간 버킷, 열=국가×제품(+Mixed/All) 테이블. 값=발행 콘텐츠수. 행/열 합계. 매트릭스 총합 = 해당 기간 content_pieces 발행 수 일치(검증 가능).
- [x] **AC-5**: 달성률 표시 [spec §3-4]
  - [x] **AC-5.1**: grain별·국가별 달성률(예정 대비 완료 %). 분모 0 = "—"(날조 금지). CSS bar 또는 표.
- [x] **AC-6**: 국가×제품·국가×티어 발행수 [spec §3-5]
  - [x] **AC-6.1**: 국가×제품 발행수, 국가×티어(creators.tier) 분포를 막대/표로(Bars 패턴 재사용).
- [x] **AC-7**: 인게이지먼트% [spec §3-6]
  - [x] **AC-7.1**: `(likes+comments+reposts+saves+shares)/views`, views>0만. "조회수 수집 n / 총 m" 투명 표기(BP feedback 부분상태). views null/0 분모 제외.
- [x] **AC-8**: 빈/이상 상태 [spec §3-9]
  - [x] **AC-8.1**: 데이터 없는 기간·조회수 없는 콘텐츠·빈 매트릭스를 깨짐 없이 명시 처리(빈 상태 카피). NaN/Infinity 방지(분모 가드).
- [x] **AC-9**: 단위 테스트 [spec §3-9·§5-5]
  - [x] **AC-9.1**: `lib/__tests__/analytics.test.ts` — AC-1.2 순수 함수 대상: 매트릭스 합·달성률 분모0·인게이지먼트 views0 제외·복합제품 Mixed·grain 버킷팅 케이스.
- [x] **AC-10**: 검증 게이트 [spec §5·§7]
  - [x] **AC-10.1**: `npm run build`·`npx tsc --noEmit`·`npm run lint`·`npm test` 통과. 매트릭스 합 = 라이브 content_pieces 대조. DB 쓰기·마이그 0 확인(읽기 전용 계약).

## 메타

| AC | 의존 | 파일 영역 | 크기 |
|---|---|---|---|
| AC-1.1 | (없음) | `lib/types.ts` | 작음 |
| AC-1.2 | AC-1.1 | `lib/analytics.ts`(신설) | 큼 |
| AC-1.3 | AC-1.2 | `lib/queries.ts` | 중간 |
| AC-2.1 | AC-1.3 | `app/analytics/page.tsx`(신설) | 중간 |
| AC-2.2 | (없음) | `components/NavTabs.tsx` | 작음 |
| AC-2.3 | AC-2.1 | `app/analytics/page.tsx` | 작음 |
| AC-3.1 | AC-2.1 | `app/analytics/page.tsx` | 작음 |
| AC-4.1 | AC-2.1 | `app/analytics/page.tsx` | 중간 |
| AC-5.1 | AC-2.1 | `app/analytics/page.tsx` | 작음 |
| AC-6.1 | AC-2.1 | `app/analytics/page.tsx` | 작음 |
| AC-7.1 | AC-2.1 | `app/analytics/page.tsx` | 작음 |
| AC-8.1 | AC-4.1·7.1 | `app/analytics/page.tsx`·`lib/analytics.ts` | 작음 |
| AC-9.1 | AC-1.2 | `lib/__tests__/analytics.test.ts`(신설) | 중간 |
| AC-10.1 | (전부) | CI·라이브 | 중간 |

> 의존성 사이클 0. 핵심 경로 = AC-1.1→1.2→1.3→2.1→(3~8). AC-2.2(NavTabs)·AC-9.1(테스트, AC-1.2 후)는 독립 분기. AC-3~8은 같은 page 영역이라 순차.

## 실행 가이드 (/enometa-execute 참조)

- **메인 Claude 직접 순차 권장**: onair-ingestion과 동일 — 집계 로직 정밀·라이브 데이터 대조·한 화면 집중이라 컨텍스트 보유한 메인이 직접. 합성 에이전트 긴 출력 스톨 전례 회피.
- 권장 순서: AC-1(타입→순수집계→fetch) → AC-9(테스트로 집계 검증, execute 중 TDD스럽게) → AC-2(라우트·탭·토글) → AC-3~8(요약·매트릭스·달성률·국가·인게이지먼트·빈상태) → AC-10(게이트).
- 착수 시 라이브 실측: 복합제품("Cream; Clay")·"all" 분포, scheduled vs posted 교차, views>0 분포로 §8 오픈항목(복합제품 열·달성률 분모·인게이지먼트 분모) 확정 후 구현.
- **안전(읽기 전용)**: DB 쓰기·마이그 0. SELECT만. 비가역 위험 없음 — 배포(push)만 외부영향. 운영 영어 UI 유지.
- 독립 병렬 가능 구간: AC-2.2(NavTabs)는 AC-1과 무관해 언제든. 단 한 화면이라 대부분 순차가 자연스러움.
