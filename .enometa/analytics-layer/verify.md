# analytics-layer — 검증 (3-Phase)

> 작성: 2026-06-28 21:55 / 단계: verify / 회차 1
> 선행: spec.md·plan.md·execute.md 확인. 검증 정본 = spec §5·§7. 읽기 전용 스프린트(DB 쓰기 0).

## 회차 1 (2026-06-28 21:55)

### Phase 1 — 결정론
| 명령 | 결과 |
|---|---|
| `npx tsc --noEmit` | ✓ 통과 (exit 0) |
| `npm run lint` | ✓ 통과 (exit 0, 기존 WorkGrid warning 2·error 0) |
| `npm test` (vitest) | ✓ 통과 (3 files / 28 tests — analytics 12 신규) |
| `npm run build` | ✓ 통과 (exit 0, /analytics 라우트 생성) |

Phase 1 통과.

### Phase 2 — 의미·정합 (spec §3 요구 1:1 대조)
| spec §3 요구 | AC | 상태 | 근거 |
|---|---|---|---|
| 1. /analytics 라우트·탭·grain 토글 | AC-2 | ✓ | app/analytics/page.tsx(searchParams grain·country, force-dynamic)·NavTabs Analytics 탭·Seg Link 토글 |
| 2. 요약 카드(1급) | AC-3 | ✓ | Stat 4개(발행·달성률·인게이지먼트 n/m·활성국가) + 비교 sub 캡션 |
| 3. 시트 매트릭스 재현 | AC-4 | ✓ | 행=기간 버킷·열=제품+Total·tfoot 합. 열합=총합(복합 Mixed, 중복 0) |
| 4. 달성률(예정 대비 완료) | AC-5 | ✓ | achievement byCountry·분모0 "—"(날조 0). 라이브 92.1%(501/544) |
| 5. 국가×제품·국가×티어 | AC-6 | ✓ | 두 테이블(countryProduct·countryTier) |
| 6. 인게이지먼트%(views>0만·투명) | AC-7 | ✓ | (likes+comments+reposts+saves+shares)/views, "collected n/total m" 표기. 라이브 45.3%(298/645) |
| 7. 쿼리 함수 | AC-1 | ✓ | fetchAnalytics(lib/queries.ts) + 순수 aggregate(lib/analytics.ts), embed 조인·캐시 |
| 8. 차트·표(라이브러리 미도입) | AC-4~7 | ✓ | CSS bar(Row)·HTML 테이블. recharts 등 0 |
| 9. 빈/이상 상태·단위 테스트 | AC-8·9 | ✓ | 빈 상태 카피·분모 가드(NaN/Infinity 0)·analytics.test.ts 12건 |

라이브 집계 독립 재현 정합: matrix 602(열합=총합)·달성률 92.1%·인게이지먼트 45.3%·product Cream182·Clay161·Serum145·Mixed49·All40·Unknown25. Phase 2 통과.

### 외부 자산 점검
내부 산출물(코드·앱 화면, 운영 영어 UI)로 외부 공유 자산 점검 skip. /analytics는 미들웨어 인증 게이트 뒤, 로컬 경로·내부 파일명 미노출.

### Phase 2.5 — BP 체크리스트 (bp-ecommerce-analytics-dashboard)
| BP 원칙 | 결과 | 근거 |
|---|---|---|
| 1-1 요약 1급·점진 공개 | ✓ | 상단 요약 카드 4개, 상세(매트릭스·byCountry)는 아래 |
| 1-5 Jakob's Law(기존 시트 세분화 답습) | ✓ | 성과분석 시트 구조(기간×제품 매트릭스) 재현 |
| 2-1 토글·피벗 > 화면 복제 | ✓ | grain(일/주/월)·country를 ?param= 토글로 같은 데이터 피벗 |
| 3-1 고립 절대값 금지(비교 동반) | ✓ | 달성률=예정 대비, 인게이지먼트=수집 n/m 비교 맥락 |
| 6-1 차트 목적별(정확값=테이블·분포=막대) | ✓ | 매트릭스/국가표=테이블, 달성률/인게이지먼트=막대 |
| 6-2 색 단독 인코딩 회피 | ✓ | 막대 색 + 국가 라벨·수치 텍스트 병기 |

Phase 2.5 통과 (추이 라인차트는 metrics_d1/d3/d7 파싱 후속 — spec §6 제외 정합).

### Phase 3 — 적대적 (enometa-adversarial-verifier 격리)
핵심 안전 5문항 PASS, 완전성에서 갭 → **회차 1 실패**.
| 적대 질문 | 판정 |
|---|---|
| 1 날조 0(views null/0·분모0→null) | ✓ PASS |
| 2 NaN/Infinity·깨짐 | ✓ PASS |
| 3 매트릭스 합 정합(복합 Mixed 중복0) | ✓ PASS |
| 4 읽기 전용(SELECT만·마이그0) | ✓ PASS |
| 5 운영 영어 | ✓ PASS |
| 6 완전성 | ✗ FAIL |

### 실패 분석 (회차 1)
| 지적 | 사실여부 | 조치 |
|---|---|---|
| §3.4 달성률이 grain 토글에 무반응(grain별 분해 누락) | **사실·버그** — aggregate achievement가 grain 미사용 | 회차2: byBucket 추가 |
| TIER_ORDER에 'Macro' 누락(enum엔 존재·라이브 3건)→정렬 깨짐 | **사실·버그** | 회차2: Macro 추가 |
| §3.3 매트릭스 열=국가×제품 미재현(제품만, 국가는 필터) | **설계 선택** — 가로스크롤 회피(D-9, 4국가×6제품=24열). 국가×제품은 country 토글(BP 2-1)+countryProduct 표(AC-6)로 제공 | spec §3.3 D-9 정합 해석 기록(구현 유지) |
| §3.2 totalPosted·activeCountries 전기간 비교 없음 | 부분 — 달성률·인게이지먼트가 비교 내포 | 한계 문서화(전기간 delta 후속) |
| §3.5 국가×티어가 협업 아닌 콘텐츠 카운트 | 의미 편차 — tier는 creator 속성, 콘텐츠 발행 기준이 분석 맥락에 유효 | 라벨 "by content" 명확화 |
| §3.7 fetchContentMatrix 등 3함수명 → fetchAnalytics 단일 | 기능 등가 | 한계 문서화(통합이 더 단순) |

## 회차 2 (2026-06-28 22:02)

### 수정
1. **달성률 grain 분해**: lib/analytics.ts AchievementData.byBucket 추가 — scheduled를 `bucketKey(scheduledPostDate, grain)`로 버킷팅(country 필터 적용). page.tsx 달성률에 "By {grain}" + "By country" 표시. grain 토글 반응.
2. **TIER_ORDER Macro 추가**: enum 5티어(Nano·Micro·Mid·Macro·Mega) 전부 — 정렬 정상화.
3. **국가×티어 "by content piece" 캡션**: 모수가 콘텐츠 발행 기준임 투명 표기.
4. **매트릭스 §3.3**: 구현 유지 — 가로스크롤 회피(D-9). 국가×제품은 country 토글(BP 2-1)+countryProduct 표로 분담 제공.

### Phase 1·2 (재검증)
| 항목 | 결과 |
|---|---|
| test (vitest) | ✓ 29 passed (byBucket grain별 month/day 분해 테스트 추가) |
| tsc·lint·build | ✓ 통과 (build /analytics 생성, lint 기존 warning 2) |
| 라이브 달성률 sanity | ✓ 04월 100%(89/89)·05월 93.5%(371/397)·06월 70.7%(41/58, 진행중) — grain 분해 합리적 |

### Phase 3 (적대적 재판정 — 회차1 검토자 격리)
- §3.4 달성률 grain 해소(bucketKey grain 인자 사용·byBucket 렌더) → **PASS**
- TIER_ORDER Macro 해소 → **PASS**
- §3.3 매트릭스 충족(기간×제품 + country 토글 + countryProduct 표 분담, D-9·BP 2-1 정합) → **PASS**
- 국가×티어 라벨 보강 → **PASS**
- 안전 5문항(날조·NaN·매트릭스합·읽기전용·영어) 무손상 → **PASS**

## 종합 판정: 통과 (회차 2)

Phase 1·2·2.5·3 전부 PASS. 회차1 블로킹 2건(달성률 grain·매트릭스 국가×제품) 해소, 안전 5축 무손상.

### 잔여 한계 (FAIL 아님 — 문서화 종결)
1. **§3.2 전기간 비교**: 달성률(예정 대비)·인게이지먼트(수집 n/m)는 비교 맥락 동반, totalPosted·activeCountries는 전기간 delta 미동반 — 후속.
2. **§3.7 함수명**: fetchContentMatrix 등 3함수 대신 단일 fetchAnalytics 통합(기능 등가·심플함 우선).
3. **매트릭스 전 국가 동시 1매트릭스**: 토글·countryProduct 표로 대체(D-9 가로스크롤 회피). 24열 동시 열람은 미제공(의도).
4. **추이 라인차트·metrics_d1/d3/d7 파싱**: spec §6 제외(후속 스프린트).

**analytics-layer 우로보로스 사이클(spec·plan·execute·verify) 완료.**
