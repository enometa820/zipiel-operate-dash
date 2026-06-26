# sheet-grid-redesign — execute

> 단계: execute / 2026-06-26 / 모드: ouroboros 자율(ultracode)

## 구현 요약

칸반 제거 + 좌측 사이드바 + 상태그룹 시트 그리드 + detail 우측 패널로 `/board`를 전면 재구성. 데이터 계약(lib/queries·lib/types·ETL·세금) 불변, 표현 레이어만 재작성.

## 신규 파일

- `lib/use-local-storage.ts` — SSR 안전 localStorage 훅(useSyncExternalStore 기반, lint-clean).
- `lib/grid-prefs.ts` — GridPrefs(density·groupBy·columnVisibility·columnOrder·collapsedGroups) + DENSITY 프리셋 + mergePrefs(스키마 진화 안전).
- `lib/status-style.ts` — **시트 정본 per-status 색 팔레트**(user/image.png 일치) + 한/영 병기 `statusLabel`.
- `components/grid/StatusPill.tsx` — StatusPill(읽기) + StatusSelectCell(인라인 편집 pill, caret ▾, 한영 병기 옵션).
- `components/DetailPanel.tsx` — 우측 슬라이드 패널(focus 트랩·aria-modal·ESC·스크롤잠금·lazy 이력/지급).
- `components/board/Sidebar.tsx` — collapsible 사이드바(VIEWS·MANAGERS/COUNTRIES 접힘·FILTERS·적용칩·Clear all).
- `components/board/GridToolbar.tsx` — Group/Density 토글 + ColumnManager(hide/reorder/reset, localStorage).

## 수정 파일

- `components/WorkGrid.tsx` — react-table(컬럼·정렬·가시성·순서) + **수동 phase/status 그룹 평탄 리스트**(정본 순서) + react-virtual 가상화 + 그룹 헤더 접기 + 밀도 + 행 선택 + frozen 첫컬럼 안전장치 + 키보드 a11y(정렬/그룹 헤더).
- `components/grid/columns.tsx` — Status=StatusSelectCell(grow2·shrink0.4로 한영 병기 보존), Fee=표시전용, 선택 컬럼(tier·type·scheduled·cpv) 추가, aria-label.
- `components/grid/EditableCell.tsx` — SelectCell/TextCell에 ariaLabel prop.
- `components/DashboardClient.tsx` — 3분할 셸(사이드바·툴바·그리드·패널), 낙관 편집 유지, flex 높이(min-h-0)로 툴바 wrap 흡수, `?all=1` 발굴풀 토글.
- `app/board/page.tsx` — 전폭 셸 위임(헤더 셸 내부로).
- `app/actions.ts` — getStatusHistory·getPaymentFor server action 추가(기존 쿼리 래핑). **WITHHOLDING_RATE export 제거**(use server 파일은 async만 export 가능 — 런타임 500 원인).
- `app/globals.css` — `.kanban-scroll` → `.thin-scroll`(범용 얇은 스크롤바).
- `lib/types.ts` — `COLUMN_DEFAULT_STATUS`(칸반 전용) 제거.
- `package.json` — @dnd-kit/* 의존 제거.

## 삭제 파일

- `components/KanbanBoard.tsx` · `components/CollaborationCard.tsx` · `components/FilterBar.tsx`(사이드바 흡수) · `components/CollaborationTable.tsx`(미사용 구 Table, 결정 D-9 폐기).

## spec 대비 의도적 조정 (기록)

1. **Status 인라인 유지** — spec §9는 status를 고위험으로 분류했으나 파이프라인 핵심 동작이라 인라인 pill 드롭다운 유지(마찰 금지). Fee·Tax만 패널 게이트.
2. **컬럼 resize 제외** — fit-to-width 무가로스크롤 보장과 상충(자유 resize는 가로 스크롤 유발). hide/reorder/reset로 커스터마이즈 제공, resize는 후속(spec §3.7 갱신).
3. **밀도값 32/40/48** — design-spec 권장·기존 ROW_H 40=regular 정렬(spec §3.8 갱신).
4. **frozen 첫 컬럼** — fit-to-width라 가로 스크롤이 0이므로 첫 컬럼은 항상 보임(목적 달성). sticky-left는 컬럼 다수 추가 시 안전장치(bp-tech 근거).

## 후속(이번 스코프 외, verify에서 defer)

- 스크롤 시 현재 그룹 헤더 sticky 오버레이(가상화와 결합 복잡).
- unverified fee를 패널에서 KRW 정정 시 fee_source provenance 갱신(화이트리스트 확장 필요 — KPI 정직성 후속).
- 컬럼 drag-resize.
