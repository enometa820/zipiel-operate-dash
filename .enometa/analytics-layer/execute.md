# analytics-layer — 실행 로그

> 작성: 2026-06-28 21:40 / 단계: execute / 선행 = plan.md
> 디스패치: 메인 Claude 직접 순차(집계 정밀·라이브 대조·한 화면). 읽기 전용(DB 쓰기 0).

## 사전 정찰 (라이브 실측 — §8 확정)
- **content_pieces 645** (onair_2026), country 조인 OK: JP226·CN225·KR135·TW59(+None). tier: Nano537·Micro77·Mid29·Mega2.
- **category 분포**: Cream190·Clay163·Serum150·all45·None27·복합(Cream;Clay10·Cream;Serum9·Cream;Mask9·Serum;Cream6·Clay;Serum5·Cream,Clay3·한글복합3).
- **제품 정규화 확정**: 단일(serum/cream/clay/mask·한글 세럼/크림/클레이/마스크)→해당 제품, "all"→All, 토큰 2+→Mixed, None/빈→Unknown. 주력 열=Serum·Cream·Clay, 그 외 All·Mixed·Unknown.
- **기간**: posted 2026-04-18~06-26(n=602)·scheduled(n=544). month=4·5·6, week=ISO. views>0=298(인게이지먼트 분모).
- **매트릭스 표현 확정**(가로스크롤 회피 D-9·BP 2-1 토글>복제): 행=기간 버킷, 열=제품+Total, 국가 필터(?country=)로 국가별 전환. 국가×제품/티어는 AC-6 누적 표로 분리.

## 실행 진행

전 AC 메인 직접 순차. 읽기 전용(DB 쓰기 0).

### AC-1 — 집계 로직·쿼리·타입 (완료)
- `lib/analytics.ts` 신설: 타입(AnalyticsData·Grain·ProductCol 등) + 순수 함수. normalizeProduct(한/영 토큰·복합→Mixed·all→All·빈→Unknown)·bucketKey(day/week=월요일ISO/month)·aggregate(매트릭스·달성률·인게이지먼트·국가×제품/티어·요약). 분모0→null·views>0만 인게이지먼트(날조 0). country 필터는 매트릭스·요약만, 비교 패널은 전체.
- `lib/queries.ts`: fetchAnalytics(grain,country) — content_pieces→collaboration→creator(country·tier) embed, onair_2026, unstable_cache(tag collabs). env 없으면 [] 폴백.
- 타입은 lib/analytics.ts에 응집(plan AC-1.1 types.ts → analytics.ts로 조정, 순수 모듈 자족).

### AC-9 — 단위 테스트 (완료, TDD 선행)
- `lib/__tests__/analytics.test.ts` 12건: normalizeProduct·bucketKey·매트릭스 합·달성률 분모0·인게이지먼트 views0 제외·복합 Mixed·country 필터·빈입력. 전체 28 passed.

### AC-2~8 — 화면 (완료)
- `app/analytics/page.tsx` 신설: 서버 컴포넌트(searchParams grain·country, force-dynamic). grain/country 토글(Link ?param=, 클라 상태 0)·요약 카드 4(발행·달성률·인게이지먼트 n/m·활성국가)·매트릭스 테이블(기간×제품+Total, tfoot 합)·달성률 by country(분모0 "—")·인게이지먼트 by country(n 표기)·국가×제품·국가×티어 표·빈 상태. 영어 UI.
- `components/NavTabs.tsx`: Analytics 탭 추가(Work board와 개발현황 사이).
- 매트릭스 = 행=기간·열=제품(가로스크롤 회피 D-9), 국가는 ?country= 필터(BP 2-1 토글>복제).

### AC-10 — 검증 게이트 (완료)
- tsc(0)·lint(기존 warning 2·error 0)·build(0, /analytics 라우트 생성)·test(28 passed). DB 쓰기·마이그 0(읽기 전용).
- **라이브 집계 독립 재현 정합**: matrix grandTotal 602(열합=총합, 복합 중복0)·달성률 92.1%(501/544)·인게이지먼트 45.3%(298/645)·product Cream182·Clay161·Serum145·Mixed49·All40·Unknown25.

## 종료
전 14 leaf 완료. 다음 = /enometa-verify analytics-layer.
