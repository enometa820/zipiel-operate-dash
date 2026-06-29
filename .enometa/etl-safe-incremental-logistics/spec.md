# etl-safe-incremental-logistics — 명세 (9칸)

> 작성: 2026-06-26 / Slug: etl-safe-incremental-logistics / 단계: spec
> 근거 정본: `research/02-슬랙-대시보드-스펙-갱신-조사.md`, `research/03-빌드계획-v2.md`(§3 정합 실행안·§7 첫 스프린트), 코드/DB 직접 대조.

## 1. 목표

대시보드의 **데이터 레이어를 "손실 없는 다중 소스 증분 적재"로 전환**하고, 그 위에 **물류비·제품원가(COGS)를 정본 테이블로 적재**한다. 한 문장: *지금처럼 ETL을 다시 돌릴 때마다 데이터·이력·인앱 편집이 통째로 지워지는 구조를 끝내고, 모든 행에 출처를 새겨, 작업자 입력·새 시트·크롤링 결과·대시보드를 안전하게 얹을 수 있는 토대를 만든다.* 이 스프린트는 작업자 시트형 입력과 대표 대시보드/시각화의 **선행 토대**이며 그 자체로 effie의 06-26 물류비·제품원가 요구를 충족한다.

## 2. 배경

effie가 새 채널(C0BDVHVNBPS, 06-25~26)에 대시보드 스펙을 재정의하면서 데이터 정본이 옛 '컨택 리스트'(발굴 풀로 격하) → 새 온에어 시트 + 배송 접수용 시트로 이동했다(research/02 §5). 이를 받으려는데 코드에 **두 개의 P0 구조 결함**이 있다(검증 confirmed):

- **(결함1) ETL 전량 삭제·재삽입.** `scripts/etl_seeding.py:224-227`이 매 실행 `DELETE id=not.is.null`로 collaborations·creators·campaigns를 통째로 지우고, `0003_status_canonical.sql:5`은 `truncate ... cascade`를 했다. 상태 전이 트리거(`0001_init.sql:120-133`)가 자동 기록하는 `collaboration_status_history`와 운영자의 인앱 상태 편집(`app/actions.ts`)이 재적재마다 소실된다. → 작업자가 시트처럼 행을 추가·편집해도 다음 적재에서 지워지므로, 이 결함을 고치기 전엔 어떤 입력 기능도 안전하지 않다.
- **(결함2) 출처 태깅 컬럼 전무.** `source_system`·`external_ref` 류가 코드 전체에 0건(grep). DB만으로 "이 행이 어느 시트·탭·행에서 왔나"를 알 수 없어 역추적·증분 머지·중복 판정·발굴풀 분리가 불가하다. 현재 발굴/active 분리는 status 휴리스틱(`lib/queries.ts:83` NOT_SOURCING)에만 의존한다.

동시에 effie는 물류비(배송 시트 송장 매칭)와 제품원가(세럼 2,438·크림 2,900·클레이 2,618원)를 요구했는데(research/02 §3-3·3-4), 이를 담을 `shipments`·`products` 테이블이 없다. 배송 접수용 시트(`1GlDP…`, EMS 371 고유 송장·물류비 합 ≈253만원)는 링크 공개로 **이미 scratchpad에 확보**되어 외부 의존 0으로 적재 가능하다. 반면 새 온에어 시트(`10ymVk…`)는 401(접근 미확보)이라 이번 스프린트 범위 밖이다.

BP 정합: 이 설계는 합성 BP `bp-ai-native-data-layer`(원본·AI생성물 분리·provenance 메타데이터, 모든 운영객체 status, HITL은 비가역에만)와 `bp-data-pipeline-observability`(ingestion run audit, 0행 vs 실패 구분, source↔target reconciliation, 멱등 upsert grain=PK, lineage/provenance, 1인·소규모는 자작이 정답)를 따른다.

## 3. 핵심 요구사항

1. **상태 EN 라벨 정정 — `On Hold` → `Payment Pending`.** effie 정본 m=지급 대기(Payment Pending)인데 `0003`에서 `On Hold`로 오개명됨(`0001`은 옳았음). KO·페이즈는 이미 정확. enum rename 마이그레이션 + `lib/types.ts`(Status 유니온·STATUS_KO·STATUSES·STATUS_PHASE·PHASE_STATUSES) + `lib/status-style.ts` + `scripts/etl_seeding.py` map_status 키 동반 수정. 기존 'On Hold' 값 행은 rename으로 자동 승계(데이터 보존).

2. **출처 태깅 컬럼 추가(증분 적재의 전제).** `collaborations`·`creators`·`shipments`에 `source_system text`(예: legacy_contact_list / ship_sheet / (장래) onair_2026 / crawler), `source_sheet_id text`, `source_tab text`, `source_row int`, `external_ref text`(소스 자연키) 추가. `external_ref`에 부분 unique 인덱스(NULL 허용)로 재동기화 멱등 보장. `source_system`에 인덱스. `creators.in_legacy_list boolean default false`(effie의 "기존 리스트업 중복 인원 별도표시·필터" 요구) 추가.

3. **ETL을 전량삭제 → 손실 없는 멱등 upsert로 재설계.** 재실행을 몇 번 하든 다음을 보장하는 계약:
   - (a) collaborations·creators·campaigns·collaboration_status_history·content_pieces·payments에 **blanket DELETE/TRUNCATE를 절대 발행하지 않는다.**
   - (b) 기존 14k 행을 **frozen 보존**하며 `source_system='legacy_contact_list'`·`in_legacy_list=true`·`external_ref`(안정 키, 예 `legacy:{handle}:{platform}`)로 1회 백필. 재실행 시 이 행들의 **인앱 status 편집과 status_history는 덮어쓰지 않는다.**
   - (c) 신규/반복 적재(이번엔 shipments·products)는 자연키 upsert(`ON CONFLICT DO UPDATE`)로 멱등. 중복 행 0.
   - (d) 모든 적재 행에 출처 좌표(source_*)를 새긴다.
   - 권장 구조: ETL을 소스별 함수/명령으로 분리(legacy=1회 import·이후 wipe 금지, shipments=반복 upsert). 기존 단일 전량재적재 스크립트 폐기.

4. **`products`(제품원가 COGS) 마스터 신설·시드.** `name(unique)·sku·cogs_krw numeric·aliases text[]`. 시드값 = 세럼 2,438 / 크림 2,900 / 클레이 2,618(effie 명시값). 명칭 정규화 별칭(클레이=마스크=clay 등) 포함. upsert(by name)로 멱등.

5. **`shipments`(물류비·송장) 테이블 신설 + 배송 시트 적재.** 컬럼 = `invoice_no(PK, 등기번호)`·`carrier(정규화: K-Packet/한중해상/EMS/SeaExpress)`·`request_date`·`processed_date`·`weight_g`·`fee_krw numeric`·`country_code`·`brand_tag(H&H 등 비-국가 태그 분리)`·`customs_no`·`delivery_status`·`source_sheet_id`·`source_row`·`match_status default 'unmatched'`. `collaborations.invoice_no text references shipments(invoice_no)` 추가. 배송 CSV(scratchpad 보유)에서 송장 dedup(제품 다행 반복 1회 집계)·carrier 라벨 정규화·H&H 분리해 upsert. **PII(수취인명·전화·우편번호·주소)는 적재하지 않는다.**

6. **정합 검증(reconciliation) 산출.** 적재 후 source↔target 대조를 스크립트/쿼리로 자동 출력: 배송 CSV 고유 송장 수 vs shipments 행수 일치, 물류비 합계 일치(송장 dedup 기준), 14k 기존 행 보존(재실행 전후 행수·status_history 카운트 불변), 전 행 source_system 채움률 100%. 이 출력이 이 스프린트의 "끝났다" 증거다.

7. **개발현황(`/status`) 최소 노출.** 새로 채워진 데이터(shipments N건·물류비 합·products·source_system 분포)를 기존 `/status`(D-5 투명 공개 페이지)에 한 줄씩 추가해 가시화한다. **대표용 대시보드/차트/시각화는 이 스프린트 범위 아님**(§6).

## 4. 제약 조건

- **외부 의존 0.** 배송 CSV·effie 명시 원가값만 사용. 새 온에어 시트(401)·온에어 송장 매칭은 이번 범위 밖(접근 확보 후 다음 스프린트).
- **비파괴·additive only.** 마이그레이션은 ADD COLUMN·CREATE TABLE·enum rename만(DROP·기존데이터 변형 금지). 라이브 Supabase(seeding-ops, 14,110 협업·12,845 크리에이터)에 적용하되 적용 전 행수·status_history 카운트 스냅샷을 남기고, 재실행 전후 불변을 검증한다(손실 0 안전 게이트, CLAUDE.md §3).
- **PII 절대선.** 배송 시트 수취인 PII는 적재·커밋 금지(송장·요금·국가·제품·중량만). 배송 CSV 원본은 scratchpad(휘발성)에만 두고 repo 미포함.
- **마이그레이션 정본 동기화.** `db/migrations/` = `supabase/migrations/`(스키마 정본). 새 마이그레이션은 0006부터 순번. `supabase db push`로 적용(vault env source 필요).
- **세금 규칙 유지.** 외국인 일괄 3.3% 금지 — payments 세금 분기(CLAUDE.md·research §8)는 이 스프린트에서 손대지 않고 유지.
- **단순함 우선.** 1인·소규모이므로 dbt/Great Expectations/Monte Carlo 같은 정식 도구는 도입하지 않는다(BP YAGNI). 자작 ETL + SQL 대조로 충분.

## 5. 성공 기준

1. `scripts/etl_seeding.py`(또는 후속 명령)를 **연속 2회 이상 실행해도** collaborations·creators·collaboration_status_history 행수가 불변이고(±0), 임의로 인앱 편집한 status 1건이 재실행 후에도 보존됨을 reconciliation 출력으로 확인.
2. 전 행 `source_system` 채움률 100%, 기존 14k = `legacy_contact_list`·`in_legacy_list=true` 태깅 완료.
3. `shipments`에 배송 CSV 고유 송장 전수 적재(행수·물류비 합계가 CSV 송장 dedup 집계와 일치), carrier 라벨 정규화 완료, H&H가 `brand_tag`로 분리됨. PII 컬럼 0.
4. `products`에 세럼·크림·클레이 원가 시드 완료, upsert 멱등(재실행 중복 0).
5. status enum이 `Payment Pending`으로 정정되고 기존 'On Hold' 행이 손실 없이 승계, `npm run build`·`npx tsc --noEmit`·`npm run lint` 통과.
6. `/status`에 shipments·products·source 분포가 노출되어 "무엇이 새로 채워졌나"가 보임.

## 6. 제외할 것

- **작업자 시트형 인라인 추가·편집 UI** — 다음 스프린트(`operator-inline-entry`). 본 토대가 이를 안전하게 만든다(전량삭제 제거·출처태깅).
- **대표용 오버뷰/Analytics/Finance 탭·차트·시각화·시계열·달성률·인게이지먼트%** — 다음 스프린트(`analytics-reporting-layer`). content_pieces 적재(온에어 의존)가 선행.
- **새 온에어 시트(B) 적재** — 401 접근 미확보(blocked). 단 본 스프린트의 출처태깅 스키마는 장래 `source_system='onair_2026'` 및 `'crawler'`(크롤링 결과)를 **수용하도록** 설계한다(스키마 전방호환, 적재 로직은 안 만듦).
- **온에어 송장↔협업 매칭 실행** — 온에어 물류탭 의존. shipments는 적재·정규화까지, `collaborations.invoice_no` 매칭은 온에어 확보 후.
- **Drop 자동 규칙(1개월 무회신)** — 비가역 자동변경 위험, 후순위(P2, 후보 큐 형태).
- **marketing_expenses(다퍼·에이전시)** — 대표 금액 확정 대기(blocked).
- **티어 임계·deal_type 4분류 정합(GM1)** — effie 합의 필요, 다음 스프린트.
- **크리에이터 발굴 크롤러 자체** — 별도 시스템(`zipiel-instgram`·`instagram-hashtag-collect`) 소관. 본 대시보드는 그 결과를 받는 적재 토대만 제공.

## 7. 검증 방법

- **Phase 1(결정론)**: `npm run build` + `npx tsc --noEmit` + `npm run lint` 통과. 마이그레이션이 `supabase db push`로 에러 없이 적용.
- **Phase 2(의미·정합)**: reconciliation 스크립트 출력으로 — (a) ETL 2회 실행 전후 핵심 테이블 행수·status_history 카운트 불변, (b) 인앱 편집 status 보존, (c) source_system 채움률 100%·legacy 태깅, (d) shipments 송장수·물류비 합 = CSV 집계, (e) products 시드·멱등, (f) enum 정정 후 'On Hold' 잔존 0. 각 항목을 spec §5와 1:1 대조.
- **Phase 3(적대적)**: 격리 검토자가 "재실행이 정말 데이터를 안 지우나(숨은 DELETE·cascade·overwrite 경로)", "PII가 shipments/커밋에 새지 않았나", "additive 외 파괴적 DDL이 섞이지 않았나"를 코드·마이그레이션·diff만 보고 판정.
- BP 체크리스트 변환(verify Phase 2.5): bp-data-pipeline-observability §2(ingestion run audit·0 vs fail·reconciliation·멱등 grain·provenance lineage·schema drift) + bp-ai-native-data-layer 체크(provenance 메타데이터·운영객체 status·1인 풀플랫폼 미설치).

## 8. 추가로 AI가 질문해야 할 것

- **ETL 재실행 시 legacy↔새 소스 status 충돌 규칙**: 같은 (handle,platform)이 legacy와 장래 onair 양쪽에 있을 때 status 우선순위(권장: onair > legacy, 단 인앱 편집 > 둘 다). 이번엔 onair 미적재라 실제 충돌은 없으나, 머지 규칙의 골격을 지금 수립할지 / 다음 스프린트로 미룰지. (권장: 골격만 — `source_system` 우선순위 함수 스텁 + 인앱편집 보존 플래그.)
- **인앱 편집 보존 판별 메커니즘**: status_history에 system이 아닌 사람(manager) changed_by가 있으면 "편집됨"으로 보고 ETL이 덮지 않게 할지(권장), 아니면 `last_synced_at` 비교로 할지.
- **`/status` 노출 범위**: 물류비 합계를 KRW로 보여줄 때 H&H(타브랜드) 포함/제외 기본값(권장: 제외, 토글).
- **reconciliation 출력 형태**: 스크립트 stdout으로 충분한지, 아니면 `/status`에 상시 패널로 둘지(권장: 스크립트 + /status 요약 1줄).

## 9. Research 요약

검증된 합성 BP(로컬 정본)와 코드·시트 직접 대조에 근거. (외부 재조사 불필요 — 도메인 BP가 카탈로그에 이미 합성되어 있음.)

- **이름**: BP — 데이터 수집 파이프라인 완전성·검증·Observability / **경로**: `~/.claude/skills/enometa-shared/references/bp-data-pipeline-observability.md` / **라이센스**: 내부 합성(출처표 16건 공개글 수렴) / **핵심 1줄**: ingestion run audit·"0행 vs 실패" status 구분·source↔target reconciliation·멱등 upsert grain=PK·provenance lineage가 적재 파이프라인 정석, 1인·소규모는 정식도구 대신 자작이 정답. / **시사점**: 출처태깅(provenance)·멱등 upsert·재실행 행수 대조를 본 스프린트 요구3·6의 검증 축으로 직접 채택.
- **이름**: BP — AX·AI-native 데이터 레이어 / **경로**: `~/.claude/skills/enometa-shared/references/bp-ai-native-data-layer.md` / **라이센스**: 내부 합성(출처표 8건) / **핵심 1줄**: 원본 데이터와 AI 생성물 분리·provenance 메타데이터, 모든 운영객체에 status, HITL은 비가역에만, 1인·초기엔 풀 데이터플랫폼 미리 안 깐다. / **시사점**: source_system 메타데이터·status enum 정합·자작 우선(YAGNI)을 설계 원칙으로 채택.
- **이름**: effie 스펙 코퍼스(슬랙 C0BDVHVNBPS 06-25~26) / **경로**: scratchpad `new-channel-history.txt`(PII·크리덴셜 제외 요약은 research/02) / **라이센스**: 회사 내부 / **핵심 1줄**: 데이터 정본 이동·15상태 정의·물류비 송장매칭·제품원가 명시값. / **시사점**: 요구1(라벨)·5(shipments)·4(COGS 시드값)의 1차 근거.
- **이름**: 코드·DB·배송 시트 직접 대조 / **경로**: `scripts/etl_seeding.py:224-227`·`db/migrations/0001_init.sql`·`0003_status_canonical.sql`·`lib/types.ts`·`lib/queries.ts:83`·배송 CSV(scratchpad) / **라이센스**: repo / **핵심 1줄**: DELETE-all·truncate·source 컬럼 0·shipments/products 부재를 라인 단위로 확인. / **시사점**: 결함1·2의 정확한 수정 지점과 비파괴 제약의 근거.
