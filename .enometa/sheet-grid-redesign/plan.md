# sheet-grid-redesign — plan (AC tree)

> 작성: 2026-06-26 / Slug: sheet-grid-redesign / 단계: plan
> 입력: spec.md 9칸. 분해 = 7개 AC 그룹, leaf = 체크박스. meta: [size S/M/L · dep: 선행]
> 진실: 코드 grounding 완료(전 파일 정독). 데이터 계약(lib/queries·actions·types) 불변, 표현 레이어(components/·app/board)만 재구성.

## AC1. 칸반 완전 제거 [size S · dep: 없음]

- [x] AC1.1 `components/KanbanBoard.tsx` 삭제
- [x] AC1.2 `components/CollaborationCard.tsx` 삭제
- [x] AC1.3 `DashboardClient`에서 `ViewMode`·`mode` 토글·`onMove`·KanbanBoard import·pipeline 분기 제거
- [x] AC1.4 `app/globals.css`에서 `.kanban-scroll` 블록 제거
- [x] AC1.5 `package.json`에서 @dnd-kit/core·sortable·utilities 의존 제거(다른 용처 0 확인 후)
- [x] AC1.6 `lib/types.ts`의 `COLUMN_DEFAULT_STATUS`·`BoardColumn` Seeding/Dropped 레인 사용처 정리(STATUS_PHASE는 그룹핑에 계속 쓰므로 유지; 칸반 전용 심볼만 제거 또는 잔존 무해 확인)
- [x] AC1.7 grep `Kanban|CollaborationCard|onMove|kanban-scroll|@dnd-kit` → 코드 0건(주석·문서 제외)

## AC2. 공유 훅·그리드 환경설정 영속 [size S · dep: 없음]

- [x] AC2.1 `lib/use-local-storage.ts` — SSR 안전 useLocalStorage 훅(초기값, hydration mismatch 회피: 마운트 후 읽기)
- [x] AC2.2 `lib/grid-prefs.ts` — GridPrefs 타입(columnVisibility·columnOrder·columnSizing·density·grouped) + 기본값 + localStorage 키 상수
- [x] AC2.3 density 프리셋 상수(condensed 36 / regular 44 / relaxed 56) 행높이·폰트·패딩 매핑

## AC3. 상태그룹 시트 그리드 [size L · dep: AC2]

- [x] AC3.1 `components/grid/StatusPill.tsx` + `lib/status-style.ts` — **시트 정본 per-status 색 팔레트**(`user/image.png` 일치: 협의군 로즈·Contract 앰버·배송군 초록·Guideline 파랑·Production 청록·Uploaded 보라·On Hold 마룬채움·Completed 다크채움·Listing/Seeding 중립·Drop 연레드). **한/영 병기 라벨** `한글 (English)`(STATUS_KO 활용). 드롭다운으로 인라인 status 변경(핵심 동작 유지). lib/types.ts에 STATUS_STYLE(또는 별도 모듈) 추가
- [x] AC3.2 `WorkGrid` 재작성 — react-table v8 grouping: 기본 6페이즈 그룹(`grouping`/`getGroupedRowModel`), 그룹핑 on/off 토글. 그룹 헤더 행(라벨+건수 배지+접기 chevron, `getToggleExpandedHandler`)
- [x] AC3.3 첫 컬럼 Creator frozen(sticky left, z-index↑, 불투명 배경) + 헤더 sticky top
- [x] AC3.4 핵심 컬럼 화면폭 fit(1024/1280/1440 가로 스크롤 0). 컬럼 set: Creator(frozen)·Status(pill)·Platform·Followers·Manager·Last contact·Fee·Listed (+ Campaign type 토글 노출)
- [x] AC3.5 인라인 편집 분리: Manager·Last contact = 셀 직접(저위험). Status = pill 드롭다운(핵심 동작, 인라인 유지 — spec §9 조정). Fee = 그리드 표시-only(편집은 패널)
- [x] AC3.6 @tanstack/react-virtual 가상화 — 그룹 헤더 행 섞인 flat row list 가상화(1.9k행 부드럽게). 그룹 접힘 시 자식 행 제외
- [x] AC3.7 행 클릭 → 선택 콜백(detail 패널 오픈). 셀 편집 클릭은 stopPropagation으로 패널 안 열림
- [x] AC3.8 컬럼 매니저: hide/show·reorder·resize + "Reset to default", localStorage 영속(AC2)
- [x] AC3.9 밀도 토글 UI(condensed/regular/relaxed), localStorage 영속

## AC4. detail 우측 패널 [size M · dep: AC3]

- [x] AC4.1 `components/DetailPanel.tsx` — 우측 슬라이드(~420px), 선택 협업 표시. 라이브러리 추가 0(Tailwind transition)
- [x] AC4.2 헤더(크리에이터 핸들·국가·팔로워·tier·platform·campaign·manager) + 섹션(Deal terms·dates·links·CPV·avg views·email·notes)
- [x] AC4.3 고위험 편집: Fee(숫자, 명시 저장)·notes·status. Tax/Payment는 "Open full page →"로 Deal Page 연결
- [x] AC4.4 상태 이력 lazy-load — `app/actions.ts`에 `getStatusHistory(id)` server action 추가(기존 fetchStatusEvents 래핑, 데이터 계약 불변), 패널 오픈 시 1회 로드
- [x] AC4.5 접근성: ESC 닫기·바깥 클릭 닫기·focus 관리·`aria` 라벨. `Open full page` 링크 = `/collaborations/[id]`

## AC5. 좌측 사이드바 [size L · dep: AC2]

- [x] AC5.1 `components/board/Sidebar.tsx` — collapsible(펼침 ~240px / 접힘 ~56px 아이콘+툴팁), lucide-react 아이콘, localStorage로 접힘 상태 영속
- [x] AC5.2 VIEWS 섹션 — saved views 프리셋(All active·My deals·This week shipping·Confirmed & waiting·Content live·Dropped). 클릭 시 GridFilters 프리셋 적용. "My deals"는 매니저 선택 필요 시 안내
- [x] AC5.3 MANAGERS·COUNTRIES 섹션 — 접힘 그룹(progressive disclosure), 항목 클릭 시 해당 필터 토글, 활성 표시
- [x] AC5.4 FILTERS 섹션 — Status·Manager·Country 상시 + "More filters"(Campaign type·검색·날짜). 기존 FilterBar 로직(StatusFilter·CheckList·Popover) 이식·재배치
- [x] AC5.5 적용 필터 칩 바(상단 sticky) + 카운트 배지 + "Clear all". hideSourcing → 발굴 풀 토글은 `?all=1` 라우팅 유지
- [x] AC5.6 기존 `FilterBar` 사용 제거(사이드바로 대체) 또는 FilterBar를 More-filters 내부로 흡수

## AC6. Board 셸 통합 [size M · dep: AC3·AC4·AC5]

- [x] AC6.1 `DashboardClient` → 3분할 셸: 좌(Sidebar) · 중(칩바 + 그리드) · 우(DetailPanel, 선택 시). 반응형(사이드바 접기·패널 오버레이)
- [x] AC6.2 상태 배선: filters(사이드바) ↔ filtered views ↔ 그리드. 선택 행 ↔ 패널. density·grouping·columnPrefs ↔ 그리드. 낙관 편집(onEdit) 유지(상태 변경 시 그룹 재배치 자연 동작)
- [x] AC6.3 `app/board/page.tsx` 헤더 정리(NavTabs 유지, 셸이 폭 전체 사용하도록 max-width 조정), phase strip은 그리드 그룹 헤더로 대체되므로 제거 또는 사이드바 요약으로 이동
- [x] AC6.4 `loadedAll`·`?all=1` 발굴 풀 로직 보존(성능 — spec §11)

## AC7. 검증·정리 [size M · dep: AC1~AC6]

- [x] AC7.1 `npx tsc --noEmit` 무에러
- [x] AC7.2 `npm run lint` 무에러
- [x] AC7.3 `npm run build` 성공
- [x] AC7.4 칸반 잔재 grep 0(AC1.7 재확인) + 미사용 import·심볼 0
- [x] AC7.5 로컬 빌드본(`npx next start`) 로그인 → `/board` 렌더 → 1024/1280/1440 가로 스크롤 0 육안 → 그룹 접기·사이드바·패널·인라인 편집 동작
- [x] AC7.6 Adversarial 격리 검토(spec 11요구사항 vs diff)

---

## 실행 메모

- **병렬 안전성**: AC1·AC2는 독립(다른 파일). AC3·AC4·AC5는 새 파일 위주라 상당부 독립이나 AC6 통합은 DashboardClient에서 수렴 → AC6은 단일 작성자(메인)가 coherent하게. 신규 컴포넌트(StatusPill·DetailPanel·Sidebar·hooks)는 충돌 면적 작음.
- **데이터 계약 불변**: lib/queries·lib/types·app/actions는 AC4.4의 server action 추가 외 변경 0. 표현만.
- **spec §9 조정 기록**: Status를 고위험으로 분류했으나 파이프라인 핵심 동작이라 인라인 유지(pill 드롭다운). Fee·Tax만 패널 게이트. 근거 = 핵심 동작에 마찰 금지(글로벌 룰: 규칙이 UX 결과를 막으면 결과 우선·1줄 기록).
- **검증 우선 ultracode**: 구현은 결합도 높아 메인이 coherent하게, 검증은 멀티에이전트 adversarial(spec정합·버그·UX/a11y·가로스크롤 증명·성능)로 철저히.
