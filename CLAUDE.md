north star: zipiel 마케팅 오퍼레이션 — 글로벌 인플루언서 시딩 협업을 수기 시트에서 표준 상태 파이프라인 대시보드로 전환

# CLAUDE.md — zipiel Seeding Ops 대시보드

(주)더프레임리스 브랜드 zipiel의 **마케팅 오퍼레이션 대시보드**. 1차 도메인 = 글로벌 인플루언서 시딩·협업 상태 관리(영어 운영). 같은 회사 `zipiel-cs-demo`(ad-metrics)와 도메인이 달라 분리.

## 정본·맥락 진입점

- **조사 답안지(SSOT)** = `research/00-조사-종합.md` — 과제 정체·AS-IS 17탭 시트·6테이블 데이터모델·기술스택 BP·세금 3갈래·인물. **작업 전 먼저 읽는다.**
- **현재 운영 시트 스냅샷** = `research/sheet-snapshot/` (17탭 원본 CSV + `_컬럼-사전.md`). 마이그레이션 소스이자 "내 모델이 실데이터와 맞나" 검증 정답지. **PII 포함 → gitignore.**
- 작업 출처 = 회사 슬랙 `#이용진-mkt오퍼레이션-대시보드`. 슬랙 읽기 = `../zipiel-cs-demo/.claude/skills/zipiel-slack/slack.py`.

## 스택·구조

- Next.js 16(App Router) · React 19 · Tailwind v4 · @dnd-kit(칸반) · @tanstack/react-table · Supabase(예정).
- 명령: `npm run dev` / `npm run build` / `npm run lint`.
- **데이터: Supabase 클라우드 연결됨(2026-06-25)**. 프로젝트 `seeding-ops`(ref `edfbpvmtcghflcqljpcp`, 서울), 별도 계정 `enometa@theframeless.co` org. 토큰·DB비번 = `~/.vault/zipiel/supabase-seeding.env`. 앱 연결값 = `.env.local`(gitignore, URL·anon·service key). `lib/queries.ts`가 fetch(env 없으면 `lib/data.ts` 목 폴백). 스키마 정본 = `db/migrations/` = `supabase/migrations/`. 스키마 변경 = `supabase db push`, 시드 = `supabase db reset --linked`.
- **RLS**: 전 테이블 RLS enabled, 0002에서 authenticated read 정책 추가(anon 차단 유지). 현재 서버가 service key로 읽기·쓰기(RLS 우회). 인증·PII 최소권한 정책은 아직.
- **실데이터 적재(2026-06-25)**: `scripts/etl_onair.py` = On-Air Sheet(진행중 협업) → 6테이블 정규화 투입(크리에이터 78·협업 79). 목 seed(`supabase/seed.sql`)를 덮어씀. 재적재 = `python scripts/etl_onair.py`(On-Air CSV는 gitignore된 `research/sheet-snapshot/`, PII는 repo 미포함). 매핑: IG→instagram·xhs→xiaohongshu·빈 status→In Discussion. ⚠️ 시트 status 미기입 多 → Negotiation 쏠림(운영팀 status 기입 필요). `db reset --linked`는 목으로 되돌아가니 실데이터는 ETL로 재적재.
- 상태머신: `lib/types.ts`의 `STATUS_PHASE`(14상태 → 6페이즈). 현재 상태는 `collaborations` 본체, 전이는 `collaboration_status_history` append-only.

## 규칙

- **범위**: 협업 상태 파이프라인 대시보드에 집중. 크리에이터 발굴(크롤링)은 별도 시스템 소관 — 여기서 만들지 않는다.
- **운영 언어 = 영어** (effie 지시). UI 카피는 영어로.
- **세금**: 외국인에 한국 3.3% 일괄 적용 금지. `payments.tax_type` 분기(국내3.3%/비거주-국내원천/비거주-국외수행=0%). 근거 = 조사종합 §8. 실제 규정은 세무사 확인.
- **PII**: 크리에이터 이메일·주소·전화는 RLS·최소권한. 실데이터 시트는 외부 공유물에 raw로 옮기지 않는다.
- **진실 우선순위**: 라이브 시트 스냅샷·코드 > 문서. 모델이 실데이터와 어긋나면 모델이 stale.

## 배포

- **Vercel 배포(2026-06-25)**: 프로젝트 `zipiel-operate-dash`(scope `tototal5542-6672s-projects`), GitHub 연결됨(push 시 자동 배포). 환경변수 3개(SUPABASE URL·anon·service) production/preview/development 등록.
- 재배포 = `vercel --prod --yes`. production URL = `vercel ls zipiel-operate-dash --prod`.
- **Deployment Protection on** — PII 대시보드라 Vercel 로그인 팀원만 접속(올바른 기본값). 팀 접근은 Vercel 팀 초대 또는 앱 자체 인증 추가 후 protection 해제. 일반 매니저(sol/anna/nhi) 접근하려면 인증 설계 필요.

## 글로벌 룰

상위 글로벌 룰(`~/.claude/CLAUDE.md`) 적용 — 심플함 우선, 정직성(날조 금지), git 자동 진행(secret 가드), 한국어 응답.
