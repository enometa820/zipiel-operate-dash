# sheet-grid-redesign — verify

> 단계: verify / 2026-06-26 / 회차 1 / 결과: 통과(블로커·메이저 0)

## Phase 1 — 결정론

- `npx tsc --noEmit` → 무에러 ✓
- `npm run lint` → 0 error (2 warning: react-table useReactTable 메모이즈 불가 — 라이브러리 특성, 불가피) ✓
- `npm run build` → 성공(전 라우트) ✓
- 칸반 잔재 grep(`Kanban|CollaborationCard|@dnd-kit|kanban-scroll|COLUMN_DEFAULT_STATUS`) → 코드 0건 ✓

## Phase 2 — 의미론 (메인 AC 대조)

spec 11요구사항 전부 구현 확인: 칸반제거·상태그룹테이블·가로스크롤0·detail패널·사이드바3구역·시트색 한영pill·컬럼커스터마이즈·밀도·인라인편집분리·시트컬럼추가노출·성능(active로드·?all=1).

## Phase 3 — Adversarial (멀티에이전트 격리, 4차원 + 종합)

워크플로우 `sheet-grid-verify`(5에이전트: spec·bugs·ux·data 병렬 + 종합). **verdict: 블로커·메이저 0**, 핵심 spec 계약 충족. 확정 11건(전부 minor/nit), 더미 2건·비결함 2건(frozen 안전장치 의도·모바일 descope) 기각.

## 런타임 시각 검증 (로컬 빌드본 localhost:3100, playwright)

- 1024/1280/1440px **페이지 가로 스크롤 0**(측정 docScrollW==clientW). 1024 세로도 0(그리드 내부 스크롤).
- detail 패널: 오픈·aria-modal·focus 패널내 이동·body 스크롤잠금·5섹션 lazy 로드·**500 없음** 확인.
- 상태 pill 시트 색·한영 병기·caret ▾·그룹 헤더 aria-expanded 확인.

## 발견·수정한 실제 결함

1. **[블로커→수정] use server 500** — `app/actions.ts` WITHHOLDING_RATE 객체 export가 "use server는 async만 export" 위반 → 패널 server action 호출 시 500. export 제거(internal화)로 해소. (런타임 검증이 잡음.)
2. **[수정] 1024 헤더 5px 가로 스크롤** — 상단 헤더가 안 줄어듦. flex-wrap + min-w-0 + truncate로 해소.
3. **[수정] Drop pill WCAG AA 실패** — fg #ef4444(대비 3.1:1) → #b91c1c(5.3:1).
4. **[수정] 상태 컬럼 압축 시 EN 손실** — grow:2·shrink:0.4로 우선 보존(넓은 화면 확장·좁은 화면 덜 축소).
5. **[수정] StatusSelectCell 편집 표식 부재** — caret ▾ 추가(시트 동일).
6. **[수정] DetailPanel focus 관리** — focus 이동·트랩·복원·aria-modal·스크롤잠금.
7. **[수정] 그리드 키보드 a11y** — 정렬·그룹 헤더 role/tabIndex/키보드 + aria-sort/aria-expanded.
8. **[수정] 사이드바·셀 aria-label** + collapsed 그룹 아이콘 클릭 시 자동 펼침.
9. **[수정] 그리드 높이 magic px** → flex-1 min-h-0(툴바 wrap 흡수).
10. **[수정] spec 정합** — 밀도값·resize descope를 spec에 반영.

## Defer (후속, 비결함·스코프 외)

- 스크롤 중 그룹 헤더 sticky 오버레이(가상화 결합 복잡, UX 후속).
- unverified fee 패널 정정 시 fee_source provenance 갱신(KPI 정직성 후속, 화이트리스트 확장 필요).
- 컬럼 drag-resize(무가로스크롤과 상충).

## 종합

3-Phase + 런타임 모두 통과. 블로커(500) 1건은 발견·수정. spec 핵심 계약 충족. 회차 1 종료.
