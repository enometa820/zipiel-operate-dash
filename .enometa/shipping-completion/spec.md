# shipping-completion — 명세 (9칸)

> 작성: 2026-06-28 / Slug: shipping-completion / 단계: spec
> 근거: research/05 §B2·§G(D0-6 국내송장·D0-7 매칭) · 라이브 실측(매칭 교집합 278) · 선행 etl_shipments.py(글로벌 371 적재)·etl_onair(tracking_number 493 적재) · BP bp-data-pipeline-observability. 자율 위임(데이터 기반 spec, 인터뷰 생략).

## 1. 목표

배송 데이터의 두 갭을 메운다: (1) **국내 송장(시트 C, gid 1579019407, 고유 398건) 미적재** → shipments에 적재, (2) **송장↔협업 연결 0건** → collaborations.tracking_number와 shipments.invoice_no를 매칭해 연결. 한 문장: *글로벌만 적재돼 있고 협업과 연결되지 않은 물류 데이터를, 국내 송장까지 적재하고 송장번호로 협업에 이어 붙여 "누구의 협업이 어떤 송장으로 발송됐나"를 답할 수 있게 한다.*

## 2. 배경

토대·온에어 스프린트로 글로벌 송장 371건이 shipments에 적재됐고(etl_shipments.py, EMS waybill), 온에어 협업 789에 tracking_number 493건이 들어왔다. 그러나 (a) 국내 송장 시트(커머스 주문 export, 697행·고유 398)는 미적재이고, (b) collaborations.invoice_no는 0건 — 송장과 협업이 끊겨 있다(글로벌 shipments match_status=matched 0).

라이브 실측으로 매칭 경로를 확인했다: collaborations.tracking_number(고유 416) 형태는 EMS형 183·국내13자리 108·12자리 120·오염 73이고, **shipments.invoice_no(글로벌)와 직접 교집합 172, 국내 송장(6890…13자리)과 교집합 106 → 합계 278건이 매칭 가능**하다. 국내 CSV는 물류 전용이 아닌 커머스 주문(판매처·주문번호·원가·송장번호·택배사·수령자주소…)이라 PII가 많고 배송비 컬럼이 불명확하다 — PII 제외·물류비 매핑은 execute 실측으로 확정한다.

## 3. 핵심 요구사항

1. **`scripts/etl_shipments.py` 확장 — 국내 송장 적재** — 국내 송장 시트(gid 1579019407)를 추가 소스로. 글로벌은 고정 인덱스였으나 국내 CSV는 컬럼 구조가 달라 **헤더 이름 매핑**으로: invoice_no=송장번호·carrier=택배사·processed_date=송장입력일(또는 배송일)·country_code=KR·source_sheet_id/source_row 태깅. 합포(한 주문 다상품)로 송장번호 중복 → invoice_no PK first-wins dedup(글로벌 패턴 재사용).
2. **PII 절대 제외** — 수령자주소·수령자우편번호·주문자이름·전화는 적재 0(글로벌 etl_shipments 규칙 동일). 송장·택배사·날짜·country·(가능 시 물류비)만.
3. **물류비(fee_krw) 매핑** — 국내 CSV에 명시 배송비 컬럼이 있으면 fee_krw로, 없으면 null(날조 금지 — 상품원가/공급가를 물류비로 위장하지 않는다). execute에서 실측 확정.
4. **송장↔협업 매칭(D0-7)** — collaborations.tracking_number를 정제(strip·유효 송장형만; "UPDATE" 등 텍스트·빈값 제외)해 shipments.invoice_no와 조인. 일치 시 (a) collaborations.invoice_no=해당 송장(FK), (b) shipments.match_status='matched'. 글로벌(172)+국내 적재분(106) 모두. 미일치(12자리·오염)는 그대로 두고 투명 집계.
5. **손실0·멱등** — blanket DELETE/TRUNCATE 0. shipments는 invoice_no PK upsert, 매칭은 collaborations.invoice_no·shipments.match_status만 갱신(status·기타 컬럼 불변). 재실행 시 신규분 외 ±0. 인앱 편집 status 불변.
6. **reconcile 확장(`scripts/reconcile.py`)** — 국내 적재수(≈398)·country=KR 분포·매칭수(글로벌+국내, 목표 ≈278)·collaborations.invoice_no 채움·shipments.match_status 분포·PII 컬럼 0·재실행 멱등. PASS/FAIL.

## 4. 제약 조건

- **PII 절대선** — 국내 CSV는 커머스 주문이라 PII(주소·이름·전화·우편번호·판매처 고객정보) 다수. 적재·커밋·로그에 raw PII 0. 원본 CSV는 gitignore된 research/ship-snapshot/에만.
- **비파괴·additive·손실0(D-16)** — 마이그레이션 없이 기존 shipments 스키마로 적재(국내도 같은 테이블). DELETE/TRUNCATE 0. 매칭은 collaborations.invoice_no·shipments.match_status만 set.
- **날조 0** — 물류비 컬럼이 국내 CSV에 없으면 fee_krw=null. 상품원가/공급가/판매가를 물류비로 위장하지 않는다. 매칭 안 되는 송장은 매칭으로 세지 않는다.
- **단순함** — 자작 ETL 확장(신규 모듈 X). 글로벌 적재·dedup·carrier 정규화 패턴 재사용.
- **외부 의존 0** — 국내 송장 시트는 로컬 스냅샷 보유. effie·대표 확인 불요.

## 5. 성공 기준

1. 국내 송장 고유 ≈398건이 shipments에 country_code=KR로 적재(글로벌 371 + 국내 ≈398), carrier(국내 택배사) 정규화, PII 0.
2. 송장↔협업 매칭 실행: collaborations.invoice_no 채움 ≈278(글로벌 172 + 국내 106), shipments.match_status='matched' 동수. 미매칭(12자리·오염 tracking)은 unmatched로 투명 집계.
3. etl_shipments 연속 2회 실행해도 shipments·collaborations 행수·status_history 멱등(신규분 외 ±0), 인앱 편집 status 보존.
4. reconcile ALL PASS(국내 적재수·매칭수·PII 0·멱등). build·tsc·lint·test 통과.
5. PII(주소·이름·전화·우편번호) 컬럼이 shipments·커밋 산출물에 0. 원본 CSV 미커밋.

## 6. 제외할 것

- **물류비 정밀 산출·비용 롤업(D1-7)** — 국내 CSV에 배송비 컬럼이 없으면 fee_krw=null로 두고 정밀 물류비는 후속(출고현황·EMS 요금 별도). 비용 롤업은 별도 스프린트.
- **출고현황 한판 피벗(국내 1767023604·글로벌)** — 일자별 출고 피벗은 후속.
- **12자리·오염 tracking 강제 매칭** — 키 불일치분은 매칭하지 않고 투명 표기. 추가 매칭 키(주문번호 등) 탐색은 후속.
- **물류 화면(/logistics)** — 본 스프린트는 데이터층(적재·매칭). 화면은 후속(또는 status/analytics에 매칭률만).
- **campaigns 1차시민화·통화 환산** — 별도 스프린트.

## 7. 검증 방법

- **Phase 1(결정론)**: `npm run build`·`npx tsc --noEmit`·`npm run lint`·`npm test` 통과(이 스프린트는 ETL·DB라 코드 변경 적음, 정합 확인).
- **Phase 2(의미·정합)**: reconcile 확장으로 — (a) 국내 적재수=시트 고유 송장(≈398), (b) 매칭수=실측 교집합(글로벌 172+국내 106≈278), (c) collaborations.invoice_no 채움=매칭수, (d) shipments 2회 실행 멱등·손실0, (e) PII 컬럼 0. + BP 체크리스트(bp-data-pipeline-observability: ingestion audit·source↔target reconciliation·멱등 grain=PK·provenance).
- **Phase 3(적대적)**: 격리 검토자가 "재실행이 데이터 안 지우나(DELETE·overwrite)", "PII가 shipments/커밋/로그에 새나", "매칭이 안 되는 송장을 매칭으로 세거나 잘못 연결하나(FK 무결성)", "물류비 없는데 상품원가를 물류비로 위장하나", "additive 외 파괴 DDL 없나"를 코드·diff로 판정.

## 8. 추가로 AI가 질문해야 할 것

- **국내 fee/weight 매핑**: 국내 CSV 헤더에 명시 배송비·중량 컬럼이 있나? 없으면 fee_krw=null·weight_g=null(원가·공급가·판매가는 물류비 아님 — 위장 금지). execute에서 헤더 실측 확정.
- **carrier 정규화**: 국내 택배사 라벨(예: "전체택배"·롯데·CJ 등)을 norm_carrier에 어떻게 추가하나. execute 실측.
- **processed_date 선택**: 송장입력일 vs 배송일 vs 발주일 중 어느 것을 processed_date로. execute 실측(채움률·의미).
- **tracking 정제 규칙**: collaborations.tracking_number의 12자리(120건)·오염("UPDATE" 등 73)을 어떻게 거르나 — 매칭 키는 shipments.invoice_no에 실재하는 값만 조인(자연 필터). 12자리가 국내 송장의 부분집합인지 execute 실측.
- **합포 중복**: 국내 송장 697행→고유 398(한 송장 다상품). invoice_no PK first-wins로 dedup(글로벌 패턴). 물류비가 행별이면 합산 여부 execute 확정.

## 9. Research 요약

- **이름**: 원본 해석·백로그(배송 갭) / **경로**: `research/05-원본-해석-백로그-화면설계.md` §B2·§G(D0-6·D0-7) / **라이센스**: repo / **핵심 1줄**: 국내 송장 697행 미적재·송장↔협업 매칭(invoice_no 조인) 백로그, etl_shipments 확장 설계. / **시사점**: 요구 1·4의 1차 근거.
- **이름**: 선행 글로벌 송장 ETL / **경로**: `scripts/etl_shipments.py`(invoice_no PK 멱등 upsert·dedup·carrier 정규화·PII 제외 5컬럼) / **핵심 1줄**: 글로벌 EMS 적재 패턴 — 국내는 헤더 매핑만 다르고 동일 골격 재사용. / **시사점**: 요구 1·2·5 — 신규 모듈 없이 확장.
- **이름**: 라이브 매칭 실측 / **경로**: 본 spec §2(collaborations tracking 416·글로벌 교집합 172·국내 교집합 106) / **핵심 1줄**: tracking_number↔invoice_no 직접 조인으로 278 매칭 가능, 키 체계 3종(EMS·국내13자리·12자리·오염) 혼재. / **시사점**: 요구 4·성공기준 2의 수치 근거.
- **이름**: BP 데이터 파이프라인 Observability / **경로**: `~/.claude/skills/enometa-shared/references/bp-data-pipeline-observability.md` / **핵심 1줄**: ingestion audit·source↔target reconciliation·멱등 upsert grain=PK·provenance lineage. / **시사점**: 요구 5·6 검증 축, verify Phase 2.5.
- **이름**: 토대 손실0 계약 / **경로**: `.enometa/etl-safe-incremental-logistics/spec.md`·etl_onair AC-4.2 / **핵심 1줄**: DELETE/TRUNCATE 0·인앱편집 status 보존·external_ref 멱등. / **시사점**: 요구 5 — 매칭 갱신이 이 계약을 깨지 않게.
