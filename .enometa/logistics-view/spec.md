# logistics-view — 명세 (9칸)

> 작성: 2026-06-29 / Slug: logistics-view / 단계: spec
> 근거: 선행 shipping-completion(shipments 769·매칭 278/282 적재) · research/05 §G(물류 화면) · BP bp-ecommerce-analytics-dashboard·enometa-dashboard 원칙(결정 우선·정직 표기·출처/신선도·집계 정합). 자율 위임(데이터 기반).

## 1. 목표

적재·매칭된 물류 데이터(shipments 769·송장↔협업 매칭 282)를 **운영 가시성 화면(`/logistics`)으로** 노출한다. "지금까지 몇 건 발송했고, 어느 나라로, 어떤 택배로, 배송 상태는 어떤지, 협업과 얼마나 연결됐는지"를 한 화면에서 본다. 한 문장: *끊겨 있던 물류 데이터를 운영자·매니저가 발송 현황·매칭률·배송 상태로 한눈에 보는 화면을 만든다.*

## 2. 배경

shipping-completion으로 글로벌 371 + 국내 398 = 769 송장이 적재되고 협업과 282건 매칭됐다. 그러나 이 데이터는 화면이 없어 board detail에서만 단편적으로 보인다. 매니저·운영자는 "이번에 몇 건 나갔나·어디로·배송됐나·협업과 연결됐나"를 통합으로 보지 못한다. status(개발현황)에 물류비 요약만 있고 발송 현황·배송 상태·매칭률은 없다.

데이터 현황(라이브): country KR398·CN121·JP110·TW46(+None 91)·HK/SG. carrier 우체국택배398·K-Packet247·한중해상119·EMS/SeaExpress. delivery_status 출고373·취소29·반품24·반환중19. 물류비 글로벌 2,536,000원(국내는 배송비 컬럼 부재로 null). 매칭 278송장→282협업.

BP(enometa-dashboard·bp-ecommerce-analytics): 결정 우선(가장 중요한 숫자 1급), 정직 표기(국내 물류비 null·매칭률 36%를 추정으로 메우지 않고 투명), 색+라벨, 집계 정합(화면 합 = DB).

## 3. 핵심 요구사항

1. **`/logistics` 라우트 + NavTabs 탭** — 운영 영어 UI. 매니저·운영자용 물류 현황.
2. **요약 카드(1급)** — 총 발송 송장(769)·매칭률(매칭 송장/총, 또는 협업 연결수)·글로벌 물류비(2.5M, 국내 제외 명시)·배송 진행(출고/완료 등). 각 카드에 정직 캡션(국내 물류비 미수집·매칭 데이터 한계).
3. **국가별 발송** — country_code별 송장 수(KR/CN/JP/TW/…). None(국가 미상)도 투명 표기. 막대/표.
4. **택배사(carrier)별 발송** — carrier별 송장 수·물류비(있는 것만). 글로벌(K-Packet·한중해상·EMS) vs 국내(우체국택배) 구분.
5. **배송 상태(delivery_status)** — 출고·취소·반품·반환중 등 분포. None(상태 미상)도 표기.
6. **매칭 현황** — 송장↔협업 매칭 수(278송장/282협업)·미매칭 송장(491)·미연결 협업. 매칭률을 정직하게(전체 대비 %, 데이터 한계 캡션).
7. **쿼리 함수** — `fetchLogistics()`(또는 기존 fetchLogisticsStats 확장) — shipments 집계(country·carrier·status·fee·매칭). 서버 집계, env 없으면 목 폴백 정합.

## 4. 제약 조건

- **읽기 전용 — DB 변경 0.** shipments·collaborations 조회·집계만. 마이그·적재 없음.
- **정직 표기(절대선·BP).** 국내 물류비 null을 0이나 추정으로 메우지 않는다(글로벌만 합산·명시). 매칭률은 실제 비율(278/769)을 투명하게, "낮다"를 숨기지 않는다. None 국가·상태도 별도 표기(누락 은폐 0).
- **집계 정합.** 화면 국가별·carrier별 합 = 총 송장(769). 매칭 수 = DB match_status=matched.
- **운영 영어.** /logistics UI 영어. 한글은 status·handoff만.
- **단순함.** 차트 라이브러리 미도입(기존 CSS bar·테이블·Stat 재사용). 성능 = 769행 서버 집계.

## 5. 성공 기준

1. `/logistics` 탭에서 요약 카드(총 발송·매칭률·글로벌 물류비·배송 진행)·국가별·carrier별·배송상태·매칭 현황이 라이브로 표시된다.
2. 국가별·carrier별 송장 합 = 769(집계 정합). 매칭 수 = DB matched(278).
3. 국내 물류비는 null로 표기(글로벌만 합산·"국내 미수집" 캡션). 매칭률·None 국가/상태가 추정 없이 투명.
4. build·tsc·lint·test 통과. DB 쓰기·마이그 0.
5. UI 영어. 빈/None 상태가 깨지지 않고 명시 처리.

## 6. 제외할 것

- **국내 물류비 산출·비용 롤업** — 배송비 컬럼 부재(shipping-completion 잔여). 후속.
- **출고현황 한판 피벗(일자별)** — 후속.
- **물류 데이터 적재·매칭 변경** — shipping-completion 소관(이번엔 표현만).
- **배송 추적(실시간 송장 조회)** — 외부 API, 범위 외.
- **미매칭 12자리 tracking 추가 매칭** — shipping-completion 후속.

## 7. 검증 방법

- **Phase 1(결정론)**: build·tsc·lint·test 통과.
- **Phase 2(의미·정합)**: (a) 국가별·carrier별 합 = 769, (b) 매칭 수 = DB matched 278, (c) 글로벌 물류비 = 2,536,000(국내 null 미합산), (d) None 국가/상태 투명, (e) UI 영어. + BP 체크리스트(enometa-dashboard 결정우선·정직표기·집계정합 / bp-ecommerce-analytics 요약1급·색+라벨).
- **Phase 3(적대적)**: 격리 검토자가 "국내 물류비 null을 0/추정으로 메우지 않나(정직)", "집계 합이 769와 어긋나지 않나", "매칭률을 부풀리지 않나", "None을 숨기지 않나", "DB 쓰기·마이그 0(읽기 전용)인가", "영어 위반 없나"를 판정.

## 8. 추가로 AI가 질문해야 할 것

- **매칭률 정의**: 송장 기준(278/769=36%) vs 협업 기준(282/온에어 협업). 둘 다 표기 권장(송장 매칭률 + 협업 연결 수). execute에서 어느 게 운영에 의미 있는지 판단.
- **물류비 표기**: 글로벌만 합산하고 "국내 미수집" 명시 vs 글로벌/국내 분리 카드. 분리가 정직(글로벌 2.5M·국내 미수집). execute 확정.
- **None 국가(91)·상태(312)**: 글로벌 송장 중 country 미상(brand_tag H&H 등)·상태 미상. "Unknown"으로 표기. execute에서 brand_tag(H&H)와 구분.
- **기존 fetchLogisticsStats 확장 vs 신규**: status가 쓰는 fetchLogisticsStats(shipments·feeKrw·products·sourceDistribution)를 확장할지 fetchLogistics 신규. 재사용 권장.

## 9. Research 요약

- **이름**: 선행 shipping-completion / **경로**: `.enometa/shipping-completion/`·`scripts/etl_shipments.py` / **핵심 1줄**: shipments 769·매칭 282 적재, country/carrier/status/fee·source_sheet_id(글로벌/국내) 컬럼. / **시사점**: 요구 2~7의 데이터 근거.
- **이름**: BP ecommerce-analytics-dashboard / **경로**: `~/.claude/skills/enometa-shared/references/bp-ecommerce-analytics-dashboard.md` / **핵심 1줄**: 요약 1급·점진공개, 고립 절대값 금지(비교·맥락 동반), 차트 목적별(분포=막대·정확값=표), 색+라벨. / **시사점**: 요구 2~6 시각화.
- **이름**: enometa-dashboard 스킬 원칙 / **경로**: `~/.claude/skills/enometa-dashboard` / **핵심 1줄**: 결정 우선·정직 표기(null·추정 투명)·출처/신선도·판정선·집계 정합. / **시사점**: 요구 3·6의 정직 표기(국내 물류비 null·매칭률) 정본.
- **이름**: 기존 물류 집계·화면 / **경로**: `lib/queries.ts` fetchLogisticsStats·`app/status/page.tsx` 물류 섹션·Bars / **핵심 1줄**: shipments 집계·CSS bar 패턴 보유. / **시사점**: 요구 7 재사용.
