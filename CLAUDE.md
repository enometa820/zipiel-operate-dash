north star: zipiel 마케팅 오퍼레이션 — 글로벌 인플루언서 시딩 협업을 수기 시트에서 표준 상태 파이프라인 대시보드로 전환

# CLAUDE.md — zipiel Seeding Ops 대시보드

(주)더프레임리스 브랜드 zipiel의 **마케팅 오퍼레이션 대시보드**. 1차 도메인 = 글로벌 인플루언서 시딩·협업 상태 관리(영어 운영). 같은 회사 `zipiel-cs-demo`(ad-metrics)와 도메인이 달라 분리.

## 정본·맥락 진입점

- **조사 답안지(SSOT)** = `research/00-조사-종합.md` — 과제 정체·AS-IS 17탭 시트·6테이블 데이터모델·기술스택 BP·세금 3갈래·인물. **작업 전 먼저 읽는다.**
- **현재 운영 시트 스냅샷** = `research/sheet-snapshot/` (17탭 원본 CSV + `_컬럼-사전.md`). 마이그레이션 소스이자 "내 모델이 실데이터와 맞나" 검증 정답지. **PII 포함 → gitignore.**
- 작업 출처 = 회사 슬랙 `#이용진-mkt오퍼레이션-대시보드`. 슬랙 읽기 = `../zipiel-cs-demo/.claude/skills/zipiel-slack/slack.py`.

## 아키텍처 (데이터 흐름)

시트 CSV(`research/sheet-snapshot/`) → `scripts/etl_seeding.py`(정규화·매핑) → Supabase Postgres → `lib/queries.ts`(fetch + snake→camel 매핑 + env 없으면 `lib/data.ts` 목 폴백) → 서버 컴포넌트 → 클라이언트(`components/`). 상태 쓰기 = `app/actions.ts` server action(service key)이 DB update → 트리거가 `collaboration_status_history` 자동 기록.

- **라우트**: `/`(칸반·테이블 대시보드) · `/status`(한글 개발현황) · `/collaborations/[id]`(Deal Page) · `/login`. 탭 전환 = `components/NavTabs.tsx`.
- **인증**: `middleware.ts` 쿠키 게이트(미인증 → /login). id/pw = env `APP_USER`·`APP_PASS`(둘 다 `theframeless!`), 세션 = `APP_SESSION_SECRET`. ⚠️ playwright는 secure 쿠키 미유지로 프로덕션 로그인 자동검증 불가 — **로컬 빌드본(`npx next start`)으로 검증**(서버 로그 `POST /login 303 → GET / 200`이 성공 신호).
- **데이터 모델**: `creators`(마스터) → `campaigns` → `collaborations`(현재 상태) → `collaboration_status_history`(전이) → `content_pieces`(성과) → `payments`(세금). 타입 정본 = `lib/types.ts`. dev HMR 워커가 크래시("Jest worker")하면 코드 문제 아닌 인프라 — 빌드/빌드본으로 확인.

## 스택·구조

- Next.js 16(App Router) · React 19 · Tailwind v4 · @dnd-kit(칸반) · @tanstack/react-table · @supabase/supabase-js.
- 명령: `npm run dev`·`npm run build`·`npm run lint` / 타입체크 `npx tsc --noEmit` / DB 적용 `supabase db push`(vault env source 필요) / 실데이터 `python scripts/etl_seeding.py` / 배포 `vercel --prod --yes`.
- **데이터: Supabase 클라우드 연결됨(2026-06-25)**. 프로젝트 `seeding-ops`(ref `edfbpvmtcghflcqljpcp`, 서울), 별도 계정 `enometa@theframeless.co` org. 토큰·DB비번 = `~/.vault/zipiel/supabase-seeding.env`. 앱 연결값 = `.env.local`(gitignore, URL·anon·service key). `lib/queries.ts`가 fetch(env 없으면 `lib/data.ts` 목 폴백). 스키마 정본 = `db/migrations/` = `supabase/migrations/`. 스키마 변경 = `supabase db push`, 시드 = `supabase db reset --linked`.
- **RLS·인증**: 전 테이블 RLS enabled(0002 authenticated read). 서버가 service key로 읽기·쓰기(RLS 우회), 앱 접근은 `middleware.ts` 쿠키 인증으로 게이트. PII 컬럼 RLS 세분화는 아직.
- **실데이터 적재(2026-06-25)**: `scripts/etl_seeding.py` = On-Air + 국가별 [List] 탭(KR·CN·JP·TW·SG·US) 통합 정규화 투입 → **크리에이터 12,845·협업 14,110**(전 탭). 목 seed 덮어씀. 재적재 = `python scripts/etl_seeding.py`(CSV는 gitignore된 `research/sheet-snapshot/`, PII repo 미포함). 매핑: IG→instagram·xhs/rednote/xiaohongshu→xiaohongshu·douyin, 한/영 status→effie 정본 15 enum, country SGP→SG 정규화, fee/followers 1억 상한(병합 오염 거름). find_col name 후보에서 "id" 제외(Candidate 오매치 방지).
- **상태머신 = effie 정본 15상태**(`lib/types.ts` Status, 스크린샷 드롭다운과 EN 라벨 일치): Listing·Contact Completed·Negotiating·Rate Inquiry·Confirmed to Proceed·Contract·Request Shipping Information·Shipping·Guideline Sent·Content in Production·Content Uploaded·Payment Pending·Simple Seeding/PR·Completed·Drop. DB enum = 0003→0006(On Hold→Payment Pending rename, D-17). `STATUS_PHASE`로 6페이즈 + Seeding/Dropped 레인. 한글 라벨 = `STATUS_KO`(툴팁). 현재 상태는 `collaborations` 본체, 전이는 `collaboration_status_history` append-only(트리거 자동).
- 날짜: ETL `to_date`로 리스트업·소통·업로드예정일 파싱(listed 87%). post_url(업로드링크) 적재. 테이블·Deal Page에 표시, 기본 정렬 listed_date desc.
- 앱 대량 대응: 칸반 컬럼 카드 상한 50, 테이블 페이지네이션, queries.ts는 1000행 cap 우회 페이지네이션으로 전체 로드.
- **잔여 갭은 대부분 시트 데이터 부재(버그 아님)**: followers 81% 복구(나머지 시트 빈값)·SGP 84(나머지 87은 시트 빈 행)·content 성과(views·likes)·Simple Seeding/PR status 시트에 거의 없음·status 대부분 Sourcing(시트 초기단계). `/status` 탭이 무엇이 채워졌나 투명 공개.

## 규칙

- **범위**: 협업 상태 파이프라인 대시보드에 집중. 크리에이터 발굴(크롤링)은 별도 시스템 소관 — 여기서 만들지 않는다.
- **운영 언어 = 영어** (effie 지시). UI 카피는 영어로.
- **세금**: 외국인에 한국 3.3% 일괄 적용 금지. `payments.tax_type` 분기(국내3.3%/비거주-국내원천/비거주-국외수행=0%). 근거 = 조사종합 §8. 실제 규정은 세무사 확인.
- **PII**: 크리에이터 이메일·주소·전화는 RLS·최소권한. 실데이터 시트는 외부 공유물에 raw로 옮기지 않는다.
- **진실 우선순위**: 라이브 시트 스냅샷·코드 > 문서. 모델이 실데이터와 어긋나면 모델이 stale.

## 배포

- **Vercel 배포(2026-06-25)**: 프로젝트 `zipiel-operate-dash`(scope `tototal5542-6672s-projects`), GitHub 연결됨(push 시 자동 배포). 환경변수 3개(SUPABASE URL·anon·service) production/preview/development 등록.
- 재배포 = `vercel --prod --yes`. production URL = `vercel ls zipiel-operate-dash --prod`.
- **Deployment Protection off** — 앱 자체 인증(`middleware.ts`)으로 대체함(vault `VERCEL_TOKEN`으로 API `ssoProtection=null`). 매니저는 Vercel 계정 없이 앱 로그인(`theframeless!`)만으로 접속. 공유 URL = `vercel ls zipiel-operate-dash --prod`의 최신 Ready.

## 글로벌 룰

상위 글로벌 룰(`~/.claude/CLAUDE.md`) 적용 — 심플함 우선, 정직성(날조 금지), git 자동 진행(secret 가드), 한국어 응답.
