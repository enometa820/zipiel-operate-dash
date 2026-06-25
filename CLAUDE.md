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
- 데이터: 현재 `lib/data.ts` 목 데이터 → Supabase로 교체 예정. 스키마 정본 = `db/migrations/`.
- 상태머신: `lib/types.ts`의 `STATUS_PHASE`(14상태 → 6페이즈). 현재 상태는 `collaborations` 본체, 전이는 `collaboration_status_history` append-only.

## 규칙

- **범위**: 협업 상태 파이프라인 대시보드에 집중. 크리에이터 발굴(크롤링)은 별도 시스템 소관 — 여기서 만들지 않는다.
- **운영 언어 = 영어** (effie 지시). UI 카피는 영어로.
- **세금**: 외국인에 한국 3.3% 일괄 적용 금지. `payments.tax_type` 분기(국내3.3%/비거주-국내원천/비거주-국외수행=0%). 근거 = 조사종합 §8. 실제 규정은 세무사 확인.
- **PII**: 크리에이터 이메일·주소·전화는 RLS·최소권한. 실데이터 시트는 외부 공유물에 raw로 옮기지 않는다.
- **진실 우선순위**: 라이브 시트 스냅샷·코드 > 문서. 모델이 실데이터와 어긋나면 모델이 stale.

## 글로벌 룰

상위 글로벌 룰(`~/.claude/CLAUDE.md`) 적용 — 심플함 우선, 정직성(날조 금지), git 자동 진행(secret 가드), 한국어 응답.
