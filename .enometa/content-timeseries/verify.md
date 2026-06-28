# content-timeseries — 검증 (3-Phase)

> 작성: 2026-06-28 23:10 / 단계: verify / 회차 1
> 선행: spec·plan·execute 확인. 검증 정본 = spec §5·§7.

## 회차 1 (2026-06-28 23:10)

### Phase 1 — 결정론
| 명령 | 결과 |
|---|---|
| `npx tsc --noEmit` | ✓ 통과 (exit 0) |
| `npm test` (vitest) | ✓ 36 passed (metrics 7건 신규) |
| `npm run lint` | ✓ 통과 (error 0, warning 2 기존) |
| `npm run build` | ✓ 통과 (exit 0) |
| `py_compile etl_onair·reconcile` | ✓ 문법 정상 |
| 마이그 0016 push | ✓ 적용(supabase db push) |

### Phase 2 — 의미·정합 (spec §3 요구 1:1, reconcile ALL PASS)
| spec §3 요구 | AC | 상태 | 근거 |
|---|---|---|---|
| 1. metrics 순수 파서 | AC-1 | ✓ | lib/metrics.ts parseMetrics·LABEL_MAP. ERROR/빈/미인식→부재(날조 0). 테스트 7건 |
| 2. 마이그 1/3/7일차 정수 컬럼(additive) | AC-2 | ✓ | 0016 views/likes/comments _d1/d3/d7 9컬럼. raw text 유지 |
| 3. etl 파싱 적재 | AC-3 | ✓ | parse_metrics(파이썬, LABEL_MAP 동일). likes_d1 340·comments_d1 340·views_d1 82 적재. raw 보존·멱등 |
| 4. analytics 추이 표시 | AC-4 | ✓ | timeseries 집계(중앙값·n) + "Growth day 1/3/7" 섹션(views/likes/comments, n 투명). 영어 |
| 5. 손실0·멱등·날조0 | AC-3·5 | ✓ | 마이그 additive·raw 유지. 2회 멱등(전 테이블 불변). 파싱 실패 null(0/추정 0) |
| 6. reconcile·테스트 | AC-5·1.2 | ✓ | 파싱 채움(likes_d1≥300) 게이트·파서 테스트 |

라이브 정합: 파싱 likes_d1 340(raw d1과 동수)·추이 중앙값 d1 813→d3 1001. reconcile ALL PASS. Phase 2 통과.

### 외부 자산 점검
내부 산출물(코드·DB)로 skip.

### Phase 2.5 — BP 체크리스트
| BP 항목 | 결과 | 근거 |
|---|---|---|
| bp-data-pipeline 멱등·provenance | ✓ | external_ref 멱등·raw 보존·source_system. 파싱 실패 null |
| bp-data-pipeline 파싱 정합(채움률 audit) | ✓ | reconcile 파싱 채움 게이트(likes_d1 raw 대비) |
| bp-ecommerce 시계열 비교 동반(3-1) | ✓ | d1/d3/d7 추이로 시간 비교 |
| bp-ecommerce 데이터 한계 투명(부분상태) | ✓ | n 표기·"No scraped data"·views 부분(82) 투명 |

Phase 2.5 통과.

### Phase 3 — 적대적 (enometa-adversarial-verifier 격리)
6문항 전부 PASS, 누락·이탈 0 → **통과**.
| 적대 질문 | 판정 |
|---|---|
| 1 날조 0(파싱 실패 null·추이 0막대 안그림) | ✓ PASS |
| 2 TS↔파이썬 파서 일치 | ✓ PASS (LABEL_MAP·정규식 동일, NaN 가드 1건 보강) |
| 3 라벨 매핑 정확(조회→views 등 교차오류 0) | ✓ PASS |
| 4 재실행 데이터 손실(raw 보존·DELETE 0·멱등) | ✓ PASS |
| 5 additive·읽기 안전(0016 ADD만·db=supabase) | ✓ PASS |
| 6 스코프·겉핥기(saves 등 컬럼화 안함·country 필터 일관) | ✓ PASS |

보강: Python parse_metrics에 빈 숫자 가드 추가(TS Number.isNaN 파리티 — 콤마-only 크래시 방지).

## 종합 판정: 통과 (회차 1)

Phase 1·2·2.5·3 전부 PASS. 적대 6문항 PASS, 파서 파리티 결함 1건 보강.

### 잔여 한계 (FAIL 아님 — 문서화 종결)
1. **views 채움 부분(d1 82·d3 109)**: IG 등 일부 플랫폼이 조회 라벨 미보고 → null(날조 0). likes/comments는 340 충실.
2. **추이 d1/d3/d7 코호트 상이**: 각 시점 n이 다른 모집단(340/307/3)이라 813→1001은 동일 콘텐츠 곡선 아님 — n 점별 표기로 투명(spec §4 정합). 동일 코호트 곡선은 후속.
3. **saves·reposts·shares·quotes·follows**: 파싱은 하나 컬럼화 안 함(raw 유지) — spec §6 제외.

**content-timeseries 우로보로스 사이클(spec·plan·execute·verify) 완료.**
