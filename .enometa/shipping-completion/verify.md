# shipping-completion — 검증 (3-Phase)

> 작성: 2026-06-28 22:22 / 단계: verify / 회차 1
> 선행: spec·plan·execute 확인. 검증 정본 = spec §5·§7.

## 회차 1 (2026-06-28 22:22)

### Phase 1 — 결정론
| 명령 | 결과 |
|---|---|
| `npx tsc --noEmit` | ✓ 통과 (exit 0, TS 무변경 — python ETL만 수정) |
| `npm test` (vitest) | ✓ 29 passed |
| `python -m py_compile etl_shipments.py reconcile.py` | ✓ 문법 정상 |
| `npm run build`·lint | ✓ TS 무변경으로 직전 통과 유효 |

### Phase 2 — 의미·정합 (spec §3 요구 1:1, reconcile ALL PASS)
| spec §3 요구 | AC | 상태 | 근거 |
|---|---|---|---|
| 1. 국내 송장 적재(etl_shipments 확장) | AC-1 | ✓ | 국내 398건 country=KR 적재(헤더 매핑·합포 dedup). 글로벌 371+국내 398=769 |
| 2. PII 절대 제외 | AC-1.2 | ✓ | shipments PII 컬럼 0(reconcile). 주소·이름·전화·우편번호 미적재 |
| 3. 물류비 매핑(없으면 null·날조 0) | AC-1.2 | ✓ | 국내 배송비 컬럼 부재 → fee_krw=null. 상품원가/공급가 위장 0 |
| 4. 송장↔협업 매칭 | AC-2 | ✓ | tracking_number∩invoice_no → matched 278 송장·연결 282 협업(N:1). 글로벌 172+국내 106 |
| 5. 손실0·멱등 | AC-2 | ✓ | 2회 실행 shipments 769·collaborations/creators/status_history/content_pieces 불변, 인앱편집 status 보존, match_status 재적재 보존. DELETE/TRUNCATE 0 |
| 6. reconcile 확장 | AC-3 | ✓ | 국내 적재수·매칭·PII 0·멱등 추가. ALL PASS |

reconcile ALL PASS(글로벌 371 CSV==DB·국내 398·매칭 278/282·PII 0·5테이블 멱등). Phase 2 통과.

### 외부 자산 점검
내부 산출물(python ETL·DB)로 외부 공유 자산 점검 skip.

### Phase 2.5 — BP 체크리스트 (bp-data-pipeline-observability)
| BP 항목 | 결과 | 근거 |
|---|---|---|
| ingestion audit(적재수·skip 로그) | ✓ | 글로벌/국내 적재수·빈송장 skip·합포 dedup 로그 |
| source↔target reconciliation | ✓ | 글로벌 CSV 371==DB·국내 398, 매칭수 대조 |
| 멱등 upsert grain=PK | ✓ | invoice_no PK on_conflict, match_status payload 제외로 매칭 보존 |
| provenance lineage | ✓ | source_system·source_sheet_id(글로벌/국내 구분)·source_row 태깅 |

Phase 2.5 통과.

### Phase 3 — 적대적 (enometa-adversarial-verifier 격리)
6문항 전부 PASS, 누락·스코프 이탈 0 → **통과**.
| 적대 질문 | 판정 |
|---|---|
| 1 재실행 데이터 삭제(match_status payload 제외·DELETE 0) | ✓ PASS |
| 2 PII 누출(build_domestic 13키 비-PII·CSV gitignore) | ✓ PASS |
| 3 물류비 위장(fee_krw=None·원가 미접근) | ✓ PASS |
| 4 매칭 FK 무결성(shp_inv 자연필터·오염 제외) | ✓ PASS |
| 5 additive·읽기 안전(마이그 0·invoice_no/match_status만 갱신) | ✓ PASS |
| 6 스코프 이탈·겉핥기 | ✓ PASS |

검출력 nit 2건(요구 실패 아님) 보강:
- 매칭 게이트 `matched>0` → `matched>=200`(매칭 급감 회귀 검출).
- "국내 적재" 라벨을 source_sheet_id 기준으로 정정 + 하한 300.

## 종합 판정: 통과 (회차 1)

Phase 1·2·2.5·3 전부 PASS. 적대 검토자 6문항 PASS, nit 2건 게이트 강화로 보강 후 reconcile ALL PASS.

### 잔여 한계 (FAIL 아님 — 문서화 종결)
1. **물류비(fee_krw) 국내 = null**: 국내 CSV에 배송비 컬럼 부재(상품원가 위장 금지). 정밀 물류비는 출고현황·EMS 요금 별도 스프린트(spec §6).
2. **미매칭 tracking**: 12자리(120)·오염("UPDATE" 등)은 매칭 키 불일치로 미연결(투명). 추가 매칭 키 탐색은 후속.
3. **물류 화면(/logistics)·출고현황 피벗·비용 롤업**: spec §6 제외(후속).

**shipping-completion 우로보로스 사이클(spec·plan·execute·verify) 완료.**
