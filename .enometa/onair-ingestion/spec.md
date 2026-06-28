# onair-ingestion — 명세 (9칸)

> 작성: 2026-06-28 / Slug: onair-ingestion / 단계: spec
> 근거: research/05(원본 완전 해석·매핑·백로그) · research/04(구조 매니페스트) · memory onair-sheet-access · 토대 스프린트 etl-safe-incremental-logistics(손실0 계약). 사용자 결정 4건(2026-06-28): 풀세트·legacy 승격·content_pieces 컬럼·캠페인 텍스트 보존.

## 1. 목표

새 온에어 시트(B, `10ymVk`)의 **국가 온에어 5탭(KR/CN/JP/TW/SG) + 드랍/홀드 탭**을 손실 없는 멱등 적재로 가져와, `collaborations`를 옛 컨택리스트(발굴 풀) 중심에서 **온에어 정본(onair_2026) 중심으로 전환**하고, `content_pieces`에 콘텐츠 성과(조회·좋아요·댓글·리포스트·북마크·공유)와 **1·3·7일차 시계열**을 적재한다. 한 문장: *대표가 가장 원하는 달성률·역산·인게이지먼트 분석의 원천 데이터를, 기존 데이터·이력·인앱 편집을 부수지 않으면서 온에어 시트에서 정본으로 받아온다.*

## 2. 배경

토대 스프린트로 손실0 증분 적재·출처 태깅이 깔렸고(D-16), 온에어 시트 접근이 enometa OAuth 토큰으로 해결됐다(D-21, memory onair-sheet-access — `~/.vault/zipiel/oauth-enometa-token.json` readonly·자동갱신). 그러나 현재 DB의 collaborations 14,110건은 전부 **옛 컨택리스트(legacy, 발굴 풀)** 출신이고, effie가 "우리의 실제 데이터"로 지정한 온에어 시트는 미적재다. 분석(달성률·시계열·인게이지먼트)의 fact가 되는 content_pieces 성과·1/3/7일차도 비어 있다(research/05 §B·§D P0). research/05의 데이터모델 매핑(§C)과 위마케팅 청사진(RAW→가공→대시보드, §B3)을 따른다.

국가 온에어 탭은 1행=1협업, effie 15상태 파이프라인이며 헤더가 EN(row4)+KO(row5) 2행이다. 단 탭별 헤더행 위치·컬럼 수가 다르다(KR 44·CN 61·JP/TW/SG 43컬럼, CN은 메트릭 블록 6회 반복). content_pieces는 1협업 N콘텐츠(채널) 관계다.

## 3. 핵심 요구사항

1. **`scripts/etl_onair.py` 신설** — 국가 온에어 5탭 + 드랍/홀드 탭을 enometa OAuth 토큰(readonly·자동갱신)으로 읽어 union 파싱. 탭별 헤더행을 동적 탐지(비어있지 않은 셀 최다 행), EN/KO 헤더 매핑 테이블로 컬럼을 정규화. 국가는 탭에서 결정(SG_온에어→SG 등).
2. **출처 태깅** — 적재 전 행에 `source_system='onair_2026'`, `external_ref='onair:{gid}:{rowIndex}'`, `source_sheet_id`·`source_tab`(gid)·`source_row`. 멱등 재동기화 보장.
3. **creators upsert** — (handle, platform) ON CONFLICT. 온에어 메타(name·followers·tier·country·manager·avg_views·email)를 정본으로 갱신. email은 DB엔 저장하되 앱 전송은 토대에서 차단됨(SELECT narrowing 유지).
4. **collaborations 적재 — legacy 승격 dedup(사용자 결정)**: 온에어 (handle,platform)이 기존 legacy 행과 일치하면 그 행을 `onair_2026`으로 **승격**하여 status·content_fee_krw·cpv·invoice_no·listed/last_contact/scheduled/upload 날짜·campaign 라벨을 온에어 정본으로 갱신(이중계상 0). 미일치는 신규 insert. **손실0 계약 유지**: blanket DELETE/TRUNCATE 0, status_history append-only 보존, 인앱 편집(status_history에 changed_by != 'system' 존재) status는 ETL이 덮지 않는다. 미일치 legacy 14k는 발굴 풀로 frozen 유지.
5. **마이그레이션 0013 — content_pieces·collaborations 확장(additive)**: content_pieces에 `reposts integer`·`quotes integer`·`concept text`·`content_type text` + 1/3/7일차 성과 스냅샷 컬럼(`views_d1·views_d3·views_d7` 및 필요한 다른 메트릭의 d1/d3/d7 — 정확한 의미는 execute에서 CSV 대조 확정). collaborations에 `campaign_label text`(온에어 Campaign 텍스트 보존용)·`partnership_code text`·`currency text`(통화 별도 선택, 값 적재는 후속). `db/migrations/` = `supabase/migrations/` 동기.
6. **content_pieces 적재** — 온에어 행의 업로드링크·원본드라이브·업로드예정일·완료일·제품·콘텐츠유형·콘텐츠비용 연결 협업에 대해 콘텐츠 행 적재(1협업 N콘텐츠). 성과(조회·좋아요·댓글·리포스트·북마크·공유) + 1/3/7일차. **Bright Data 에러 문자열("ERROR: …")·"#REF!"·"-" 등은 null로 정제.** content_pieces도 source_system 태깅(0011 패턴), 멱등 키(collaboration_id + post_url 또는 external_ref).
7. **드랍/홀드 탭 반영** — 해당 협업의 status를 Drop/Payment Pending(홀드 매핑) 등 effie 정본으로. 단 인앱 편집 보존 규칙 동일 적용.
8. **Campaign = 텍스트 보존만(사용자 결정)** — 온에어 Campaign 값을 `collaborations.campaign_label`에 보존. campaigns 테이블 1차시민화(brand×country×ded/int 구조화)는 본 스프린트 제외(다음 D1-5). 기존 campaigns(Gifted/Paid/Affiliate) 매핑은 유지.
9. **reconcile 확장(`scripts/reconcile.py`)** — 온에어 적재 검증: 시트 유효행 수 vs onair_2026 협업 수 일치, source_system 분포(onair_2026 신규·legacy 잔존), content_pieces 적재 수, 1/3/7일차 채움률, **손실0**(재실행 전후 행수·status_history 불변, 인앱 편집 status 보존, legacy frozen 행수 불변), PII 컬럼 0. PASS/FAIL.

## 4. 제약 조건

- **외부 의존 0** — 온에어 시트 접근 해결됨(enometa OAuth). 캠페인 마스터·다퍼/에이전시 금액·통화 환산 정책은 본 스프린트 불요.
- **비파괴·additive only** — 마이그레이션은 ADD COLUMN·CREATE TABLE만. 라이브 DB(seeding-ops) 적용 전 행수·status_history 스냅샷, 재실행 전후 불변 검증(손실0 게이트, CLAUDE.md §3).
- **PII 절대선** — 온에어 email·이름·주소, 배송 PII는 raw 커밋·외부 전송 금지. email은 DB 저장하되 앱 SELECT 미전송(토대 위생 유지). 원본 CSV는 gitignore된 `research/onair-snapshot/`에만.
- **손실0 계약(D-16) 유지** — DELETE/TRUNCATE 0, status_history append-only, 인앱 편집 우선. 분리축 = source_system.
- **단순함** — 자작 ETL + SQL 대조. dbt/GE 미도입.
- **마이그레이션 정본 동기화** — db/=supabase/, 0013부터 순번, `supabase db push`.

## 5. 성공 기준

1. `scripts/etl_onair.py`를 **연속 2회 실행**해도 collaborations·creators·content_pieces·status_history 행수가 멱등(신규 적재분 외 ±0), 중복 0, 인앱 편집 status 1건이 재실행 후 보존됨을 reconcile로 확인.
2. 국가 온에어 5탭 + 드랍/홀드의 유효행이 `onair_2026`으로 적재(시트 유효행 수와 일치), legacy 중복분은 승격(이중계상 0), 미일치 legacy는 frozen.
3. content_pieces에 온에어 성과(조회·좋아요·댓글·리포스트·북마크·공유) + 1/3/7일차가 적재되고, Bright Data 에러·#REF!·"-"는 null로 정제됨.
4. 마이그 0013 적용 후 build·`npx tsc --noEmit`·lint·`npm test`(vitest) 통과, reconcile ALL PASS.
5. PII(email·이름·전화·주소) 컬럼이 content_pieces·신규 컬럼·커밋 산출물에 0. 원본 CSV 미커밋.
6. lib/types.ts에 content_pieces 신규 필드·collaborations 신규 필드 타입 반영(빌드 정합).

## 6. 제외할 것

- **캠페인 1차시민화**(brand×country×mode·target·deadline·역산) — 다음 스프린트(D1-5). 이번엔 campaign_label 텍스트 보존만.
- **Analytics 화면**(일/주/월 콘텐츠수·달성률·인게이지먼트% 시각화) — 다음 스프린트(D1-1~4). 본 스프린트는 데이터층까지.
- **국내 배송 적재(697건)·송장 매칭** — 별도 스프린트(D0-6/7).
- **오프라인(매장형·서울링크)·에이전시·CN_현지브랜드/미니프로그램** — 스코프 판단 후순위(P2).
- **통화 환산·채널 N분할·재무 롤업** — 후속(D1-6/7). currency 컬럼은 추가하되 값 적재·환산은 안 함.
- **인게이지먼트% 계산·표시** — content_pieces에 원천 메트릭만 적재. 계산은 analytics 스프린트.

## 7. 검증 방법

- **Phase 1(결정론)**: `npm run build` + `npx tsc --noEmit` + `npm run lint` + `npm test`(vitest) 통과. 마이그 0013 `supabase db push` 에러 0.
- **Phase 2(의미·정합)**: `scripts/reconcile.py` 확장 출력으로 — (a) 온에어 적재수 = 시트 유효행, (b) ETL 2회 실행 행수·status_history 불변·인앱편집 보존, (c) legacy 승격 dedup 중복0·미일치 frozen, (d) content_pieces 성과·1/3/7일차 적재·에러문자열 null 정제, (e) source_system 채움률 100%, (f) PII 컬럼 0. spec §5와 1:1 대조. + BP 체크리스트(bp-data-pipeline-observability: ingestion audit·reconciliation·멱등 grain·provenance / bp-ai-native-data-layer: provenance·운영객체 status·자작).
- **Phase 3(적대적)**: 격리 검토자가 "재실행이 데이터를 안 지우나(숨은 DELETE·cascade·overwrite)", "승격 로직이 legacy를 이중계상하거나 인앱편집을 덮지 않나", "PII가 content_pieces/신규컬럼/커밋에 새지 않나", "additive 외 파괴 DDL 없나"를 코드·마이그·diff만 보고 판정.

## 8. 추가로 AI가 질문해야 할 것

- **국가탭 컬럼 정규화**: KR 44·CN 61·JP/TW/SG 43컬럼으로 다르다. CN_온에어는 메트릭 블록(조회수~공유수)이 6회 반복 — 어느 블록이 정본 최신인지 execute에서 CSV 대조로 확정(권장: 마지막 비어있지 않은 블록 또는 1일차 기준). 공통 컬럼 매핑 테이블을 execute 착수 시 5탭 헤더 실측으로 확정.
- **1/3/7일차 의미**: 컬럼이 단일 값(조회수 d1/d3/d7)인지 복합인지 CSV 실측 확정. 스키마는 우선 views_d1/d3/d7로 두고 실측 후 보정.
- **content_pieces 멱등 키**: post_url 우선, 없으면 (collaboration_id, source_row). 업로드 전(링크 없음) 행 처리 — content_pieces 미생성 또는 scheduled만 보유한 placeholder.
- **드랍/홀드 status 매핑**: 홀드 = Payment Pending인지 별도 개념인지(effie엔 '보류' 개념 없음 — D-17). 드랍 = Drop. execute에서 드랍/홀드 탭 status 컬럼 실측.

## 9. Research 요약

- **이름**: 원본 완전 해석·백로그·시트재현 설계 / **경로**: `research/05-원본-해석-백로그-화면설계.md`·`research/04-원본-추출-매니페스트.md` / **라이센스**: repo / **핵심 1줄**: 온에어 국가탭 구조(44컬럼·15상태)·content_pieces 매핑·갭(온에어 미적재·성과/시계열 부재)·시트재현 청사진(RAW→가공→대시보드). / **시사점**: 요구1~9의 컬럼 매핑·적재 단위·갭의 1차 근거.
- **이름**: 온에어 시트 접근법 / **경로**: memory `onair-sheet-access` / **핵심 1줄**: enometa OAuth 토큰(readonly·자동갱신)으로 Sheets API 읽기, 실제 gid·탭 구조. / **시사점**: 요구1 추출 경로.
- **이름**: BP 데이터 파이프라인 Observability / **경로**: `~/.claude/skills/enometa-shared/references/bp-data-pipeline-observability.md` / **핵심 1줄**: ingestion audit·source↔target reconciliation·멱등 upsert grain=PK·provenance lineage, 1인은 자작. / **시사점**: 요구2·9 검증 축.
- **이름**: BP AI-native 데이터 레이어 / **경로**: `~/.claude/skills/enometa-shared/references/bp-ai-native-data-layer.md` / **핵심 1줄**: 원본/생성물 분리·provenance·운영객체 status·풀플랫폼 미설치. / **시사점**: 요구3·4 source_system 분리축·손실0.
- **이름**: 토대 손실0 계약 / **경로**: `.enometa/etl-safe-incremental-logistics/spec.md`·`scripts/etl_seeding.py` SAFE SYNC / **핵심 1줄**: DELETE/TRUNCATE 0·status 미기재·external_ref 멱등·legacy frozen. / **시사점**: 요구4·7 승격이 이 계약을 깨지 않게.
