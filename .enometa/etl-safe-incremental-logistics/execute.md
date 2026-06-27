# etl-safe-incremental-logistics — 실행 로그

> 작성: 2026-06-27 / 단계: execute / 선행 = plan.md
> 디스패치 원칙: 메인 Claude 직접(CSV 구조·enum·라인 컨텍스트 완비 + 라이브 DB 안전 핵심 + 합성에이전트 스톨 전례). 라이브 DB 적용은 스냅샷 게이트 동반.

## 사전 분석 (CSV 정본 확정)
- 배송 정본 = `ship-2081447250.csv`(EMS 운송장, 387 데이터행). `ship-538882395.csv`는 접수폼(송장 대부분 빈값) → 미사용.
- 고유 송장 **371개**(spec "EMS 371" 일치), 요금합(송장 dedup) **2,536,000원**(spec "≈253만원" 일치), 중량합 139,470g.
- carrier(구분) 분포: K패킷 147·k 패킷 19·k패킷 5·K-Packet 77(→K-Packet 248) · 한중해상 119 · EMS 4 · SeaExpress 3 · 빈 13.
- 국가코드(col11): CN 123·JP 111·H&H 91·TW 46·HK 2·SG 1·빈 13. **H&H 91건 = brand_tag 분리**(col12는 수취인명 PII → country로 미사용).
- PII 컬럼(수취인명·전화·우편번호·주소 = col9·10·13·14) **미적재**.

## 실행 진행

전 AC 메인 Claude 직접 처리(컨텍스트 완비·라이브 안전 핵심). 디스패치 표 기준 큰 AC(3.3·5.2)도 직접 — subagent 재전달 비용·합성에이전트 스톨 전례 회피.

### AC-1 — 상태 EN 라벨 'On Hold'→'Payment Pending' (완료)
- 수정: `db/migrations/0006_payment_pending.sql`(+supabase 20260627100000) enum rename(데이터 자동 승계) · `lib/types.ts` 5곳(Status·STATUS_KO·STATUSES·STATUS_PHASE·PHASE_STATUSES) · `lib/status-style.ts` · `scripts/etl_seeding.py` map_status · 연쇄 정합: `lib/data.ts`(mock 2곳)·`components/board/Sidebar.tsx`(Status 타입 에러 방지).
- 검증: grep 'On Hold' 잔존 = 마이그/문서/이력만(라이브 코드 0). reconcile 'On Hold' 잔존 0 PASS.

### AC-2 — 출처 태깅 컬럼 (완료)
- `0007_source_tagging.sql`: collaborations source_system·source_sheet_id·source_tab·source_row·external_ref + external_ref 부분 unique(NULL 허용)·source_system 인덱스. creators source_system·in_legacy_list. `lib/types.ts` Creator(sourceSystem·inLegacyList)·Collaboration(sourceSystem·externalRef) 옵셔널 필드.

### AC-3 — ETL 전량삭제→손실0 멱등 동기화 (완료)
- `scripts/etl_seeding.py` 재설계: blanket DELETE(224-227) 제거, history/content/payments DELETE/TRUNCATE 0. 캠페인=type 재사용·누락만 생성, creators=(handle,platform) upsert merge(source 태깅), collaborations=count>0이면 재삽입 생략(frozen)·fresh면 external_ref 인라인. **status는 어떤 write payload에도 미포함 → 인앱 편집·이력 전수 보존(AC-3.4, 조건부 skip보다 강함).** source_system 백필=PATCH 상수 1콜. external_ref 기존행 백필=`0010_legacy_backfill.sql`(컬럼 표현식 'legacy:'||id, PostgREST PATCH 불가라 SQL).
- 실증: 연속 2회 재실행 — collaborations/creators/status_history 행수 ±0, 인앱 편집 status 보존.

### AC-4 — products(COGS) 마스터 (완료)
- `0008_products.sql`: products(name unique·sku·cogs_krw·aliases) + 시드 세럼 2438·크림 2900·클레이 2618 on conflict do update(멱등). `lib/types.ts` Product 인터페이스.

### AC-5 — shipments + 배송 적재 (완료)
- `0009_shipments.sql`: shipments(invoice_no PK·carrier·날짜·weight_g·fee_krw·country_code·brand_tag·customs_no·delivery_status·source_*·match_status) + collaborations.invoice_no FK. `lib/types.ts` Shipment.
- `scripts/etl_shipments.py` 신설: ship-2081447250.csv → 송장 dedup 371건, carrier 정규화(K-Packet 247·한중해상 119·EMS 2·SeaExpress 3), H&H 91건 brand_tag 분리(국가코드 칸 오염), customs_no=수출신고번호1~4 첫값. **PII(수취인명·전화·우편번호·주소) 미적재.** invoice_no upsert 멱등.

### AC-6 — reconciliation + 안전 스냅샷 (완료)
- `scripts/reconcile.py`: snapshot 모드(전 행수·인앱편집 sample) + check 모드(송장수·물류비 CSV==DB·source 100%·products 시드·On Hold 0·재실행 전후 불변·편집 보존). 최종 ALL PASS ✅.

### AC-7 — /status 노출 (완료)
- `lib/queries.ts` fetchLogisticsStats(shipments·물류비 전체/H&H제외·products·source 분포, 캐시). `app/status/page.tsx` "물류·제품 원가·데이터 출처" 섹션 + FEATURES·LOG 2항목.

### 라이브 DB 적용 (additive only, 안전 게이트 통과)
- 적용 전 스냅샷(14110/12845/history 0) → AC-3.4 테스트 편집 1건(Sol 협업 Listing→Contact Completed, history changed_by=Sol) → 재baseline 스냅샷 → 마이그 0006~0010 push → ETL safe sync·배송 적재 → 2회차 재실행 → reconcile ALL PASS → **테스트 편집 행 원상복구(Listing)**.
- Phase 1 결정론: tsc 0 · lint 0 errors · build 성공.

## 종료
전 20 leaf 완료. 다음 = /enometa-verify etl-safe-incremental-logistics (3-Phase 검증).
