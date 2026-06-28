# shipping-completion — 실행 로그

> 작성: 2026-06-28 22:20 / 단계: execute / 선행 = plan.md
> 디스패치: 메인 Claude 직접 순차(etl_shipments 한 파일·라이브 안전·CSV 실측). 라이브 적용은 스냅샷 게이트.

## 사전 정찰 (국내 CSV 실측 — §8 확정)
- 국내 시트 696행, 송장 13자리 694·고유 398. carrier(34)="전체택배" 695(단일). country=KR.
- 헤더 매핑: invoice=33·carrier=34·proc_date=32(송장입력일 datetime)·req_date=30(발주일)·weight=50(중량 g, 34~161 샘플)·status=4(출고628·취소63·반품2).
- **배송비 컬럼 없음**: 원가24·공급가25·총공급가26은 상품원가, 정산22·수수료23은 정산 → fee_krw=null(날조 금지). weight_g=중량(50).
- **PII 제외**: 수령자우편번호35·주소36·주문자이름39·전화40·휴대폰41·수령자이름42·전화43·휴대폰44.
- 매칭: collaborations.tracking_number(고유 416) ∩ shipments.invoice_no — 글로벌 172 + 국내 적재후 106 = 278. match_status는 upsert에서 제외(재적재 시 매칭 보존).

## 실행 진행

전 AC 메인 직접 순차. 라이브 적재·매칭은 스냅샷 게이트.

### AC-1 — 국내 송장 적재 (완료)
- etl_shipments.py 함수화(build_global 고정인덱스 + build_domestic 헤더매핑). 국내: invoice=33·carrier=34(우체국택배)·proc_date=32(송장입력일)·req_date=30·weight=50(중량 g)·country='KR'. fee_krw=null(배송비 컬럼 부재, 상품원가 위장 금지). PII(주소·이름·전화·우편번호) 제외. 합포 invoice PK first-wins dedup.
- 결과: 글로벌 371 + 국내 398 = 769 upsert. carrier 우체국택배398·K-Packet247·한중해상119·EMS2·SeaExpress3. 국가 KR398·CN121·JP110·None91·TW46.

### AC-2 — 송장↔협업 매칭 (완료)
- collaborations.tracking_number ∩ shipments.invoice_no 직접 조인(shipments에 실재하는 값만 — 12자리·오염 자연 필터). 일치 시 collaborations.invoice_no=송장(FK)·shipments.match_status='matched'.
- match_status는 upsert payload에서 제외 → 재적재해도 매칭 보존(손실0).
- 결과: 신규연결 282 협업 → 278 고유 송장(N협업:1송장). 2회차 재실행 신규0·기존282(멱등).

### AC-3 — reconcile 확장 (완료)
- 글로벌 송장 대조를 source_sheet_id 한정(국내 적재로 안 깨지게). 국내 적재수·매칭(matched 송장·연결 협업 N:1)·shipments PII 컬럼 0·shipments 멱등(snapshot diff) 추가.

### AC-4 — 라이브 적용·검증 (완료)
- 스냅샷→etl 1회(769·매칭282)→snapshot→etl 2회(멱등)→reconcile **ALL PASS**. tsc 0·test 29·py_compile.
- 멱등: shipments 769 불변·collaborations/creators/status_history/content_pieces 불변·인앱편집 status 보존. PII 0. DELETE/TRUNCATE 0.

## 종료
전 6 leaf 완료. 다음 = /enometa-verify shipping-completion.
