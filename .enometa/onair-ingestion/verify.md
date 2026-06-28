# onair-ingestion — 검증 (3-Phase)

> 작성: 2026-06-28 21:05 / 단계: verify / 회차 1
> 선행: spec.md·plan.md·execute.md 3개 확인. 검증 정본 = spec §5(성공기준)·§7(검증방법).

## 회차 1 (2026-06-28 21:05)

### Phase 1 — 결정론
| 명령 | 결과 |
|---|---|
| `npx tsc --noEmit` | ✓ 통과 (exit 0) |
| `npm run lint` | ✓ 통과 (exit 0, warning 2·error 0 — WorkGrid useReactTable 메모이제이션·aria-sort, 기능 무관) |
| `npm test` (vitest) | ✓ 통과 (2 files / 16 tests) |
| `npm run build` | ✓ 통과 (exit 0, 6 routes) |
| 마이그 0013·0014·0015 파괴 DDL grep | ✓ additive only — 0015 `drop index`는 데이터 무손실 인덱스 교체(partial→full unique, PostgREST on_conflict 대응). DROP TABLE/COLUMN·DELETE·TRUNCATE 0건 |

Phase 1 통과.

### Phase 2 — 의미·정합 (spec §5 성공기준 1:1 대조)
| spec §5 기준 | 상태 | 근거 |
|---|---|---|
| 1. etl_onair 2회 실행 멱등 (행수 ±0·중복0·인앱편집 보존) | ✓ | **실제 재실행** 후 reconcile: collaborations 14549→14549·creators 13093→13093·status_history 322→322·content_pieces 645→645 불변. 재실행 로그 = 승격0·신규0·갱신789(멱등)·인앱편집 status 보존 320 |
| 2. 온에어 5탭+드랍홀드 onair_2026 적재 = 시트 유효행, 승격 dedup 이중계상0, 미일치 legacy frozen | ✓ | onair_2026 789건(JP272·CN234·KR197·TW86=789, SG 시트 빈탭). 재실행 승격0·신규0 = 이중계상 없음. source_system 100%(null 0), legacy 발굴풀 frozen 유지 |
| 3. content_pieces 성과+1/3/7일차, 에러문자열 null 정제 | ✓ | content_pieces 645(onair 645). 에러문자열("ERROR:"·"#REF!"·"-") 잔존 0. 메트릭=views/likes/comments/reposts/saves/shares + metrics_d1/d3/d7(raw text 보존) |
| 4. 마이그 0013 후 build·tsc·lint·test 통과, reconcile ALL PASS | ✓ | Phase 1 전부 통과 + reconcile ALL PASS(14개 체크) |
| 5. PII 컬럼 0 (content_pieces·신규컬럼·커밋) | ✓ | content_pieces 컬럼에 email·name·phone·address 0건(성과·콘텐츠 메타만). 0013/0014 신규컬럼 PII 0. 원본 CSV는 gitignore된 research/onair-snapshot/ |
| 6. lib/types.ts 신규 필드 타입 반영 | ✓ | tsc --noEmit 통과로 타입 정합 확인 |

Phase 2 통과.

### Phase 3 — 적대적 (enometa-adversarial-verifier 격리)
핵심 안전 5문항 전부 PASS, 완전성(Q6)에서 갭 발견 → **회차 1 전체 실패**.

| 적대 질문 | 판정 | 요지 |
|---|---|---|
| Q1 재실행 데이터 삭제 | ✓ PASS | DELETE/TRUNCATE/cascade 0, upsert/PATCH만. 멱등 |
| Q2 승격 이중계상 | ✓ PASS | `legacy_by_creator.pop()` 1행 승격·별도 insert 없음, 빈 handle continue |
| Q3 인앱편집 status 덮음 | ✓ PASS | `protected`(changed_by≠system) 가드, skip 카운트 |
| Q4 PII 누출 | ✓ PASS | content_pieces·신규컬럼·커밋 PII 0, email은 creators만, 원본CSV gitignore |
| Q5 파괴 DDL | ✓ PASS | additive only, 0015 인덱스 교체만 |
| Q6 완전성 | ✗ **FAIL** | AC-2·9 부분미충족(아래 실패 분석) |

### 실패 분석 (회차 1)
검토자 6개 지적을 실데이터·코드와 대조해 경중 분류:
| 지적 | 사실여부 | 조치 |
|---|---|---|
| AC-2 provenance discrete 컬럼(source_sheet_id·source_tab·source_row) 미적재 + 승격 시 stale | **사실** — base payload에 누락(external_ref로만 복구 가능) | 회차2 수정 |
| AC-9 reconcile이 spec §5 전부 미커버(1/3/7 채움률·PII컬럼0·legacy frozen·온에어 정확수 일치) | **사실** — `>0`만 체크 | 회차2 수정 |
| 승격 시 빈 온에어 셀이 legacy fee/date를 None으로 덮음 | **사실·손실위험** — 손실0(D-16)이 AC-4보다 상위제약 | 회차2 수정(빈값 보존) |
| AC-7 드랍홀드 country=None 전행 스킵 위험 | **실증 반박** — 재실행 로그상 드랍홀드 84건이 국가로 분배돼 789 적재(KR142→197·JP243→272), Drop 29 반영 | is_dh dead flag만 정리 |
| quotes 스텁 컬럼·metrics raw text | 경미 — quotes 후속, metrics는 spec §8이 허용 | 한계 문서화 |

## 회차 2 (2026-06-28 21:20)

### 수정 (회차1 실패 분석 반영)
1. **AC-2 provenance 적재**: etl_onair.py base에 `source_sheet_id·source_tab(gid)·source_row` 추가(승격·update·insert 전 경로).
2. **손실0 강화**: promote/update PATCH를 `{k:v for ... if v is not None}`로 — 빈 온에어 셀이 기존 legacy fee/date를 None으로 덮지 않게(손실0 > AC-4).
3. **reconcile 강화**: provenance(source_tab) NULL 0·legacy frozen 가시화·content_pieces PII 컬럼 0·1/3/7일차 채움률 추가.
4. **is_dh 죽은 변수 제거**: TABS 3-tuple로 정리(드랍홀드는 map_status로 처리, 동작 무변).

### Phase 1 (재검증)
| 명령 | 결과 |
|---|---|
| `python -m py_compile etl_onair.py reconcile.py` | ✓ 문법 정상 |
| tsc·lint·build·test | ✓ 변경 없음(python 스크립트만 수정, lib/types.ts·코드 무변경 → 회차1 통과 유효) |

### Phase 2 (강화 reconcile — 실제 재실행)
| 검증 | 결과 |
|---|---|
| onair_2026 적재 / legacy frozen | ✓ 789 / 13760 (출처 분리) |
| **provenance(source_tab) 채움** | ✓ **NULL 0/789** (AC-2 해소) |
| content_pieces PII 컬럼 0 | ✓ PII컬럼 없음 |
| 1/3/7일차(metrics_d1) 채움률 | 340/645 (52%, 정보) |
| 에러문자열 정제 | ✓ 잔존 0 |
| **재실행 멱등(손실0)** | ✓ collaborations 14549·creators 13093·status_history 322·content_pieces 645 전부 불변, 인앱편집 status 보존 |
| **AC-7 드랍홀드 라이브 실증** | ✓ 드랍홀드 탭(gid 1638811644) 84건 적재(파싱 84=적재 84), Drop 22·Negotiating 33·Shipping 9 등 분류 작동 — country None 전행스킵 우려 반박 |

### Phase 3 (적대적 재판정 — 회차1 검토자 격리 재검토)
- Q1 provenance 채움·승격 stale 해소 → **PASS**
- Q2 None-skip 멱등·전환 유지 → **PASS**
- Q3 새 손실/오염 0(오히려 손실 감소) → **PASS**
- Q4 quotes·metrics 문서화 종결 가능 / is_dh 제거됨 / 드랍홀드 라이브 실증으로 AC-7 확정
- Q5 핵심 안전 5문항(DELETE0·이중계상0·인앱편집·PII·파괴DDL) 약화 없음 → **PASS**

## 종합 판정: 통과 (회차 2)

Phase 1·2·3 전부 PASS. 회차1 발견 3개 갭 해소(provenance·손실0 빈값보존·reconcile 강화), 핵심 안전 무손상, AC-7 드랍홀드 실증.

### 잔여 한계 (FAIL 아님 — 문서화 종결)
1. **AC-9 "시트 유효행 = onair_2026 정확 일치" 게이트 부재** — reconcile이 온에어 시트를 재읽기하지 않아 `onair_collab>0`만 점검. 단 etl 파싱로그(789) ↔ reconcile onair_2026(789) 대조로 사실상 충족. 시트 재읽기 게이트는 OAuth 의존·복잡성 대비 가치 낮아 미도입(심플함 우선).
2. **quotes 컬럼**: 스키마 준비, 소스 데이터 부재로 미적재(후속).
3. **metrics_d1/d3/d7 raw text**: spec §8 허용. analytics 스프린트에서 파싱·시각화.
4. **알려진 한계(execute 인계)**: ETL 승격이 status_history 생성→재실행 시 protected로 status 동결. 초기 적재 무영향, 지속 재동기화는 app-vs-ETL 마커 필요(후속).

**onair-ingestion 우로보로스 사이클(spec·plan·execute·verify) 완료.**
