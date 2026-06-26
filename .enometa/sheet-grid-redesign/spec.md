# sheet-grid-redesign — 명세 (9칸)

> 작성: 2026-06-26 / Slug: sheet-grid-redesign / 단계: spec

## 1. 목표

운영팀이 익숙한 **구글 스프레드시트 경험을 웹앱에 최대한 재현**한다. 좌측 사이드바(뷰·매니저/국가·필터) + 화면폭에 fit되는 시트형 그리드 + 행 클릭 시 우측 detail 패널 구조로, **가로 스크롤을 완전히 없애고**, "이해 어렵다"는 칸반 파이프라인을 제거해 **상태별 그룹 테이블 하나**로 통일한다. 작업자가 시트의 행 멘탈모델(행=협업 1건의 생애주기)을 그대로 유지하면서, 상태·금액·날짜·담당을 한 화면에서 정렬·필터·인라인 편집할 수 있게 한다.

## 2. 배경

- 현재 `/board`는 시트형 그리드(`WorkGrid` 10컬럼, `overflow-x-hidden`)와 칸반(`KanbanBoard` 8컬럼, `overflow-x-auto`)을 토글로 제공한다.
- 운영팀 피드백: (1) "파이프라인(칸반)이 사용감 불편하고 이해하기 어렵다", (2) "가로로 스크롤되는 게 불편하다".
- 코드상 원인 정밀 진단(grounding 완료):
  - 칸반 8컬럼(6페이즈+Seeding+Dropped)을 동시 표시 → `kanban-scroll`로 가로 스크롤 구조적 강제. 드래그 시 `PHASE_STATUSES[col][0]`로 페이즈 첫 상태 강제 → 2번 클릭 유발(`DashboardClient.tsx` onMove).
  - 그리드는 `overflow-x-hidden`으로 스크롤은 막았으나 1200px 미만 화면에선 우측 컬럼(Fee·Last contact)이 그냥 잘림. 첫 컬럼 고정·detail 패널 부재.
  - 사이드바 없음(상단 `NavTabs` 3탭만). 시트 17탭(국가/매니저별) 멘탈모델이 필터로만 흩어져 있음.
- BP 조사 결론(Airtable·Attio·Smartsheet·monday·Linear·GRIN): 업계 표준 = **좌측 사이드바 + 중앙 고밀도 그리드 + detail 패널** 3분할. "테이블이 본체, 칸반은 토글 뷰"로 수렴. 칸반은 상태 단일축에 갇혀 정렬·필터·빠른입력이 약하고, 다상태를 가로 컬럼으로 펼치면 가로 스크롤이 구조적으로 발생.
- 사용자 결정(2026-06-26 AskUserQuestion 2건):
  - **파이프라인 = 칸반 완전 제거, 상태그룹 테이블만**(가장 단순).
  - **사이드바 = 뷰 + 매니저/국가 그룹 + 필터 모두 한 사이드바**(단 progressive disclosure로 무게 관리).

## 3. 핵심 요구사항

1. **칸반 완전 제거**: `KanbanBoard.tsx`·`CollaborationCard.tsx`·드래그 이동 로직(`onMove`)·`kanban-scroll` CSS·@dnd-kit 의존(칸반 전용이면) 제거. Pipeline/Board 토글 UI 제거. 단 상태 전이 자체(인라인 status 편집 → DB update → history 트리거)는 유지.
2. **상태별 그룹 테이블**: 그리드에 "상태별 그룹핑" 모드를 둔다. 상태(또는 6페이즈) 단위 그룹 헤더(라벨 + 건수 배지) + 그룹 접기/펼치기. 가로가 아니라 세로로 상태별 묶음을 펼침(칸반의 세로 대체). 그룹핑 off(평면 정렬) 토글도 제공, 기본은 상태 그룹핑.
3. **가로 스크롤 0**: 핵심 7~8컬럼만 화면폭에 fit(반응형). 첫 컬럼(Creator)은 frozen sticky(가로 스크롤이 남더라도 행 식별자 항상 노출), 헤더는 세로 스크롤 시 sticky. 고정 컬럼은 높은 z-index + 불투명 배경.
4. **행 클릭 → 우측 detail 패널**: 그리드에서 빠진 저빈도·PII 컬럼(이메일·주소·전화·세금구분·소통노트·후보제품·협상내용·송장·post URL 등)과 상태 전이 이력을 우측 슬라이드 패널로 본다. 패널 안에서 고위험 편집(상태 전이·금액·세금구분)을 의도적 마찰로 처리. 전체 상세는 기존 `/collaborations/[id]` Deal Page로 연결.
5. **좌측 사이드바(collapsible)**:
   - VIEWS: 저장된 뷰(All active / My deals / This week shipping / Confirmed 대기 등) — 시트 탭 대응. saved views는 1급 항목.
   - MANAGERS / COUNTRIES: 매니저·국가 그룹 네비(클릭 시 해당 필터 적용). 기본 접힘(progressive disclosure).
   - FILTERS: 고빈도 필터(Status·Manager·Country/Platform) 상시 노출, 나머지(Campaign·Tier·날짜 등)는 "More filters"로 접힘.
   - 접기 토글(chevron) 상시 노출, 접힌 상태는 아이콘+툴팁. 그리드에 폭 양보.
   - 적용된 필터는 상단 sticky 칩 + 카운트 배지 + "Clear all"로 항상 가시화.
6. **상태 컬러 pill (시트 정본 팔레트·한/영 병기)**: 상태를 텍스트가 아니라 색 pill로 표시하되, **effie 실제 시트 드롭다운(`user/image.png`)의 per-status 색 팔레트를 따른다** — 협의군(Contact Completed·Negotiating·Rate Inquiry·Confirmed to Proceed)=로즈/분홍, Contract=앰버, 배송군(Request Shipping·Shipping)=초록, Guideline Sent=파랑, Content in Production=청록, Content Uploaded=보라, On Hold=진한 마룬(채움·흰글씨), Completed=다크(채움·흰글씨), Listing·Simple Seeding/PR=중립 그레이, Drop=연한 레드. 일반 페이즈 파스텔로 덮어쓰지 않는다(브랜드·도메인 정본 우선). 라벨은 **한/영 병기** `한글 (English)`(시트와 동일, 사용자 2026-06-26 지시 "한글영어 둘 다 좋다"). 드롭다운 옵션은 전체 병기, 그리드 셀 pill은 병기 표시 + 길면 truncate·tooltip 전체.
7. **컬럼 커스터마이즈**: 컬럼 hide/show·reorder + "Reset to default" 버튼. 설정은 localStorage에 세션 간 저장. (resize는 fit-to-width 무가로스크롤 보장과 상충 — 자유 resize는 가로 스크롤을 유발하므로 이번 스코프에서 제외, 후속. 핵심 컬럼은 fit-to-width로 자동 분배.)
8. **밀도 토글**: 행 높이 고정 + 밀도 프리셋(condensed 32 / regular 40 / relaxed 48px — 기존 ROW_H 40=regular 기준 정렬). 선택값 localStorage 저장.
9. **인라인 편집 분리**: 저위험 필드(Manager·Last contact·메모)는 셀에서 직접 편집. 고위험(Status 전이·Fee·세금구분)은 detail 패널/모달 게이트(검증 마찰). 기존 낙관 갱신(즉시 UI 반영 후 persist, 실패 시 롤백) 유지.
10. **시트 컬럼 추가 노출**: 현재 10컬럼 외에 운영 핵심도 중 이상인 시트 컬럼(Source·Reason for Outreach·Scheduled post date·Post URL 등)을 그리드 또는 detail 패널에 노출해 "시트 39컬럼 중 10개만 보임" 답답함 해소. 어느 컬럼이 그리드 vs 패널인지 명시.
11. **반응형·성능**: 기본 active(~1.9k)만 로드 유지(`?all=1`로 발굴 풀). 그룹 테이블이 1.9k행에서 부드럽게 동작(필요 시 그룹별 가상화/페이지네이션). 가로 스크롤 0은 데스크톱·노트북(1024px+) 전 구간에서 성립.

## 4. 제약 조건

- 스택 유지: Next.js 16 App Router · React 19 · Tailwind v4 · @tanstack/react-table. @dnd-kit는 칸반 제거로 불요해지면 제거(다른 용처 없으면).
- **운영 언어 = 영어**(effie 지시) — 구조 UI(사이드바·필터·버튼·뷰명·detail 패널 라벨)는 영어 기준. **단 상태(Status) 라벨은 한/영 병기**(effie 시트가 한/영 병기이고 사용자 2026-06-26 "한글영어 둘 다 좋다" 지시 — 프로젝트 CLAUDE.md 영어전용 규칙보다 사용자 명시 지시·도메인 정본 우선). 상태 외 핵심 인지 요소엔 한글 보조(tooltip 등)를 가치 있을 때 더한다.
- 데이터 모델·ETL·Status 15상태 enum·STATUS_PHASE·세금 분기는 **변경하지 않는다**(이번 스코프는 표현·UX 레이어). `lib/types.ts`·`lib/queries.ts` 페치 계약 유지, 표현만 재구성.
- PII(이메일·주소·전화)는 detail 패널에서만 노출, 그리드 기본 컬럼에서 제외. 외부 공유물에 raw 이동 금지.
- 검증: playwright는 secure 쿠키 미유지 → 로컬 빌드본(`npx next start`)으로 로그인·동작 확인(`POST /login 303 → GET / 200`).
- 안전: DB destructive·외부 발송·게시 없음(순수 프론트 UX 작업). git push는 추적 브랜치 자동.

## 5. 성공 기준

- 1024px·1280px·1440px 전 폭에서 그리드 **가로 스크롤바 0**, 핵심 컬럼 전부 보이고 첫 컬럼(Creator) 고정.
- 칸반 관련 코드(`KanbanBoard`·`CollaborationCard`·onMove 드래그·kanban-scroll)가 **레포에서 제거**되고, Board는 상태그룹 테이블 단일 뷰.
- 상태별 그룹 테이블이 동작: 그룹 헤더·건수·접기/펼치기, 그룹핑 on/off 토글.
- 좌측 사이드바 동작: VIEWS 전환·MANAGERS/COUNTRIES 그룹 필터·상시 필터·More filters·collapse·적용 필터 칩.
- 행 클릭 시 우측 detail 패널이 열리고 저빈도/PII 컬럼·상태 이력 표시, 고위험 편집은 패널에서.
- 상태 컬러 pill·밀도 토글·컬럼 커스터마이즈(+reset, localStorage 영속) 동작.
- `npm run build`·`npm run lint`·`npx tsc --noEmit` 모두 통과.
- 로컬 빌드본 로그인·`/board` 렌더·인라인 편집(저위험)·detail 편집(고위험) 정상.

## 6. 제외할 것

- 크리에이터 발굴(크롤링) — 별도 시스템 소관, 만들지 않음.
- 성과 지표(views·likes 등) 자동 수집·시각화 — 시트 데이터 부재(별도 갭, 이번 스코프 아님).
- payments 실제 지급 입력 기능 확장 — 별도 백로그(직전 세션 next), 이번엔 detail 패널에서 기존 PaymentEditor 연결만.
- Status enum·ETL·세금 분기 로직 변경 — 표현 레이어만 다룸.
- Overview(`/`)·`/status` 페이지 재설계 — 이번은 `/board`(작업면) + 사이드바 + detail 패널 중심. (사이드바는 board 우선, 전역 적용은 무리 없으면 차후.)
- 모바일(<1024px) 최적화 — 데스크톱·노트북 우선. 모바일은 깨지지 않는 수준만.

## 7. 검증 방법

- **결정론(Phase 1)**: `npm run build` 성공, `npm run lint` 무에러, `npx tsc --noEmit` 무에러. 칸반 파일·심볼 grep 0건(제거 확인).
- **의미론(Phase 2)**: §3 요구사항 11개를 코드 diff와 1:1 대조 — 칸반 제거·상태그룹·frozen 컬럼·sticky 헤더·detail 패널·사이드바 3구역·컬러 pill·컬럼 커스터마이즈·밀도·인라인 편집 분리·컬럼 추가노출 각각 구현 확인.
- **육안/실행**: 로컬 빌드본(`npx next start`) 로그인 후 `/board`에서 1024/1280/1440 폭 가로 스크롤 0 확인, 그룹 접기·사이드바·detail 패널·인라인 편집 동작 확인.
- **Adversarial(Phase 3)**: spec과 git diff만 아는 격리 검토자가 요구사항 충족·누락·겉핥기 판정.

## 8. 추가로 AI가 질문해야 할 것

- 사이드바를 `/board` 전용으로 둘지, Overview·status 포함 전역 셸로 올릴지 → **이번은 board 우선**(전역화는 깨짐 없으면 후속). 자율 진행 중 전역 적용이 자연스러우면 적용하고 1줄 보고.
- 상태 그룹핑 단위를 15상태로 할지 6페이즈로 할지 → **기본 6페이즈 그룹(접으면 페이즈, 펼치면 그 안의 상태들도 가능)**. 15개를 한 번에 펼치면 그룹이 너무 잘게 쪼개져 스캔성 저하. 실행 중 더 나은 형태 발견 시 채택.
- detail 패널 vs Deal Page 역할 분담 → **패널=빠른 보기·고위험 편집, Deal Page=전체 상세**. 패널에서 "Open full page" 링크.
- 컬럼 커스터마이즈·밀도·뷰를 localStorage(클라) vs DB 저장 → **이번은 localStorage**(단순·1인~소수 운영, DB 스키마 변경 회피). 팀 공유 뷰가 필요해지면 후속.

## 9. Research 요약

BP 조사(WebSearch·WebFetch, 출처 병기) + 시트 스냅샷·코드 재독 grounding으로 도출. 핵심 출처·시사점:

- **Attio — Understanding lists** (https://attio.com/help/reference/attio-101/attios-data-model/understanding-lists) · 라이선스: 공개 문서 · 핵심: "파이프라인은 별도 모듈이 아니라 list를 칸반 뷰로 전환한 것일 뿐" · 시사점: 테이블이 본체, 칸반은 토글 → 칸반 제거해도 데이터 모델은 그대로, 표현만 바꾸면 됨.
- **Airtable — Grid view / Record detail** (https://support.airtable.com/docs/airtable-grid-view, /docs/airtable-interface-layout-record-detail) · 공개 문서 · 핵심: "첫 필드 기본 frozen, 스페이스바로 record detail" · 시사점: 첫 컬럼 고정 + 핵심만 그리드·나머지 detail 패널이 정석(요구사항 3·4).
- **Pencil & Paper — Enterprise Data Tables / Filtering** (https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables, /ux-pattern-analysis-enterprise-filtering) · 공개 아티클 · 핵심: "모든 컬럼 욱여넣기(#allthethings) 금지, detail-on-demand 사이드 패널이 가장 scalable, 왼쪽 sticky = 헤더 sticky만큼 중요, 내비와 필터 분리, 적용 필터는 중복 가시화" · 시사점: 요구사항 3·4·5·7의 직접 근거.
- **Tabulator — Table Layout** (https://tabulator.info/docs/6.3/layout) · 공개 문서 · 핵심: "responsive layout — 테이블 폭에 맞춰 우선순위 낮은 컬럼 자동 숨김" · 시사점: 화면폭 fit + 저우선 컬럼 숨김으로 가로 스크롤 제거(요구사항 3).
- **Kanban vs List / List grouping** (https://www.mursa.me/blog/kanban-vs-list-view-tasks, https://www.kanbanchi.com/blog/list-grouping) · 공개 아티클 · 핵심: "칸반은 상태 단일축일 때만 우월, list가 정렬·필터·빠른입력 강함; 상태별 grouped rows = 칸반의 세로 버전" · 시사점: 상태그룹 테이블이 칸반의 정당한 대체(요구사항 2).
- **GRIN — Influencer CRM** (https://grin.co/product/influencer-crm-platform/) · 공개 제품 페이지 · 핵심: "relationship stage 파이프라인 + 크리에이터당 통합 프로필(연락처·요율·이력·성과)" · 시사점: detail 패널에 협업 이력·소통 모으는 게 도메인 기대치(요구사항 4), zipiel effie 15상태 = relationship stage.
- **로컬 grounding**: `WorkGrid.tsx`(overflow-x-hidden 10컬럼)·`KanbanBoard.tsx`(8컬럼 가로스크롤)·`DashboardClient.tsx`(onMove 강제전이)·`grid/columns.tsx`(컬럼 정의)·`lib/types.ts`(Status 15·STATUS_PHASE)·`lib/queries.ts`(active/all 페치)·`research/sheet-snapshot/_컬럼-사전.md`(실제 39컬럼). 시사점: 변경 면적은 표현 레이어(components/) 집중, 데이터 계약 불변.

> 후속 권유: `/enometa-bp design-datatable`로 데이터테이블 UX BP를 한 번 깊게 카탈로그화하면 다음 사이클부터 재사용 가능(강제 아님).
