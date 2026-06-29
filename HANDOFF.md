# 프로젝트 인계 — zipiel Seeding Ops 대시보드

> 이 프로젝트를 이어받는 분을 위한 **단일 진입점**입니다. 이 문서 하나로 "무엇을·어디서·어떤 권한으로·다음에 무엇을" 파악할 수 있게 정리했습니다.
> 더 깊은 내용은 각 섹션이 가리키는 문서로 들어가면 됩니다.

---

## 1. 이게 무슨 프로젝트인가 (한 줄)

(주)더프레임리스 브랜드 **zipiel**의 **글로벌 인플루언서 시딩·협업 운영 대시보드**. 예전에 여러 탭짜리 구글 시트로 손으로 관리하던 협업을, 표준 단계 파이프라인 + 실데이터 대시보드로 옮긴 웹 앱입니다. 운영 언어는 영어(화면), 인계·개발현황 문서만 한글입니다.

- **라이브 앱**: 최신 production URL은 Vercel 프로젝트 `zipiel-operate-dash`의 Ready 배포. 매니저는 Vercel 계정 없이 앱 로그인만으로 접속(비번은 아래 접근 권한 참조).
- **저장소**: GitHub `enometa820/zipiel-operate-dash` (private). main에 push하면 Vercel이 자동 배포.

---

## 2. 5분 안에 전체 파악하기 (읽는 순서)

1. **이 문서(HANDOFF.md)** — 지금 보는 것. 큰 그림·접근권한·남은 일.
2. **`CLAUDE.md`** (repo 루트) — 아키텍처·데이터 흐름·스택·명령어·규칙의 기술 진입점. AI 도구(Claude Code)도 이 파일을 먼저 읽습니다.
3. **`research/00-조사-종합.md`** — 과제 정체·데이터 모델·기술 스택 결정의 SSOT(정본). 작업 전 먼저 읽으세요.
4. **`research/03-빌드계획-v2.md`** — 남은 기능 로드맵(P0~P2)과 화면 설계. **다음에 뭘 만들지가 여기 다 있습니다.**
5. **`.planning/intel/decisions.yaml`** — 왜 이렇게 만들었는지 결정 이력(D-1~D-23). "이거 왜 이래?" 싶으면 여기.
6. **앱 `/handoff`·`/status` 탭** — 비개발자(운영자·대표)도 현황을 보는 화면. 라이브 데이터로 "지금 무엇이 들어있나"를 보여줍니다.

---

## 3. 접근 권한 이전 체크리스트 ⚠️ (가장 먼저 챙길 것)

코드는 GitHub에 다 있지만, **실제로 돌리려면 아래 접근 권한이 필요**합니다. 키 값은 이 문서에 적지 않습니다 — 현재 보관 위치와 이전 방법만 적습니다.

| # | 무엇 | 현재 상태 | 이전 방법 |
|---|---|---|---|
| 1 | **GitHub repo** | `enometa820/zipiel-operate-dash` (private) | 인수자를 collaborator로 추가하거나 소유권 이전 |
| 2 | **Supabase (DB)** | 프로젝트 `seeding-ops` (ref `edfbpvmtcghflcqljpcp`, 서울), 계정 `enometa@theframeless.co` org | 계정 자체 이양 또는 인수자를 org 멤버로 초대. DB 비번·토큰 재발급 권장 |
| 3 | **Vercel (배포)** | 프로젝트 `zipiel-operate-dash`, scope `tototal5542-6672s-projects`, GitHub 연결 자동배포 | 인수자를 팀 멤버로 추가하거나 프로젝트 이전. 환경변수 3개(SUPABASE URL·anon·service) 재등록 |
| 4 | **앱 환경변수** | `.env.local` (gitignore, repo에 없음) — SUPABASE URL·anon·service key + APP_USER·APP_PASS·APP_SESSION_SECRET | 인수자가 본인 환경에 새로 작성. Supabase 값은 #2에서, 앱 로그인 비번은 자유 변경 |
| 5 | **온에어 시트 읽기** | Google OAuth 토큰(운영계정 권한). ETL이 온에어 시트를 읽을 때 사용 | 인수자 계정으로 OAuth 재발급 또는 운영계정 토큰 이전 |
| 6 | **슬랙** | 작업 출처 채널(`#이용진-mkt오퍼레이션-대시보드` 등). 봇 토큰으로 읽음 | 슬랙 앱 토큰 재발급 또는 이전 |
| 7 | **원본 시트 CSV** | `research/*-snapshot/` (PII 포함 → gitignore, repo에 **없음**) | 별도 안전 채널로 전달하거나, 인수자가 #5 접근으로 재추출 |

> 키·비밀번호 값은 절대 평문으로 메신저·이메일·이 문서에 적지 마세요. 비밀번호 관리자나 안전한 채널로 전달하고, 가능하면 인수자 명의로 **재발급**하는 게 깔끔합니다.

---

## 4. 지금 어디까지 돼 있나

- **배포**: 라이브 운영 중. main push → Vercel 자동배포.
- **데이터**(라이브 Supabase): 협업 약 14,500건·크리에이터 약 13,000명·콘텐츠 성과 645건·송장 769건. 출처가 모두 태깅돼 있어(온에어 정본 / 발굴 풀 / 작업자 입력) 시트를 다시 가져와도 안 지워집니다.
- **화면**(6탭): Overview(대표·매니저 건강도) · Work board(운영자 작업면, 추가·편집 가능) · Analytics(성과 분석) · Logistics(물류) · 개발현황 · 인수인계.
- **완료·다음 할 일의 사람이 읽을 요약**은 앱 `/handoff` 탭과 `/status` 탭에 항상 최신으로 유지돼 있습니다.

---

## 5. 남은 작업 — 최우선은 "캠페인 보드"

상세 로드맵은 `research/03-빌드계획-v2.md` (P0~P2). 가장 중요한 것:

- **P0-C. 캠페인 KPI 보드 + 마감 역산** ★ **대표의 최강 미충족 니즈** — 운영 단위는 협업 1건이 아니라 **캠페인 = 국가_브랜드_dedicated/integrated(번호)**(예: `dr.deep_SG_integrated(3)`). 캠페인별 Target·Confirmed·CR·Remaining·추가 필요 컨택수·D-day(시작+40일)를 한 화면에 보여주고, "며칠 안에 몇 명 더 섭외해야 하는지"를 역산. 설계·명명규칙·목표 수치·마감 규칙이 `research/01`·`03`·`05`에 모두 정리돼 있습니다.
  - **알아둘 난점 하나**: 각 협업이 어느 캠페인 소속인지가 적재 데이터엔 약합니다(온에어 `Campaign` 컬럼은 유형 Gifted/agency가 들어 있음). 운영팀도 수기로 "어느 캠페인인지 더블체크"를 합니다(`research/01` §5.3). 그래서 ① 캠페인 마스터(목록·목표·시작일)를 시드하고 ② 협업에 캠페인을 배정하는 흐름(이미 만들어둔 Work board의 입력/편집 토대를 확장)이 핵심입니다. 마이그 컬럼 설계는 `research/05` D1-5에 있습니다(`campaigns`에 brand·country·mode·target_count·deadline·pic·focus_product 추가).
- **그 외**: 다통화·1/N 채널 분배 재무 정합(P0-D), 동일 코호트 성과 추이, 국내 물류비(배송비 칸 부재), 크롤 결과 적재(별도 크롤러 연결).

---

## 6. 이어받을 때 꼭 지킬 규칙

- **데이터를 지우지 않기** — 적재는 기존 데이터·상태 이력·사람이 손으로 고친 값을 보존하는 증분 방식만. 전체 삭제 후 재적재 금지(과거에 이걸로 데이터가 날아간 적이 있어 구조적으로 막아둠).
- **DB 변경은 더하기만** — 컬럼·테이블 추가는 OK, 기존 것 삭제·대량 변경은 사람 확인 후에만.
- **개인정보 보호** — 크리에이터 이메일·이름·주소·전화는 화면에 그대로 내보내거나 외부로 옮기지 않음. 콘텐츠·성과 데이터에는 개인정보를 두지 않음.
- **운영 언어는 영어** — 운영자가 쓰는 화면 문구는 영어(시트 정본과 일치). 한글은 인계·개발현황 문서에만.
- **세금은 거주지별 분기** — 외국인에게 한국 3.3% 일괄 적용 금지(실제 규정은 세무사 확인).
- **정직한 수치** — 추정·빈 데이터는 투명하게 표기, 지어낸 값 금지.

---

## 7. 개발자 온보딩 (코드를 이어받는 분)

### 첫날 로컬 띄우기
1. repo clone → `npm install`
2. `.env.local`을 루트에 작성(gitignore라 repo에 없음) — 키 6개:
   - `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_KEY` (3번 Supabase에서)
   - `APP_USER` · `APP_PASS` · `APP_SESSION_SECRET` (앱 로그인 — 자유 설정)
3. `npm run dev` → `localhost:3000`. **env가 없어도 `lib/data.ts` 목 데이터로 폴백**되어 DB 없이도 화면은 뜹니다(연결 후 실데이터로 전환).

### 데이터 흐름 (한눈에)
시트 CSV → `scripts/etl_seeding.py`·`etl_onair.py`·`etl_shipments.py`(정규화·출처 태깅) → Supabase Postgres → `lib/queries.ts`(fetch + snake→camel 매핑, env 없으면 `lib/data.ts` 목 폴백) → 서버 컴포넌트 → 클라이언트(`components/`). 상태·입력 쓰기 = `app/actions.ts` server action(service key) → DB 트리거가 상태 이력을 자동 기록.
- 타입 정본 = `lib/types.ts`. 집계·판정 순수함수 = `lib/{analytics,metrics,logistics,stuck}.ts`(테스트 정본, `lib/__tests__/`).
- 스키마 정본 = `db/migrations/` = `supabase/migrations/`. 변경 = `supabase db push`(vault env source 필요), 시드 = `supabase db reset --linked`.
- 라우트: `/`(Overview) · `/board`(작업면) · `/collaborations/[id]`(Deal) · `/analytics` · `/logistics` · `/status` · `/handoff` · `/login`. 인증 = `middleware.ts` 쿠키 게이트.

### 검증·배포
- 타입 `npx tsc --noEmit` · 테스트 `npm test`(vitest) · 빌드 `npm run build` · lint `npm run lint`
- 배포 = main에 push하면 Vercel 자동, 또는 `vercel --prod --yes`
- 실데이터 재적재 = `python scripts/etl_seeding.py` (원본 CSV는 gitignore된 `research/*-snapshot/`가 있어야 함 — 3번 #7 참조)

### 미리 알아둘 함정 (시간 아낌)
- **dev HMR 워커가 "Jest worker" 크래시** → 코드 문제 아닌 로컬 인프라 현상. `npm run build` 또는 빌드본(`npx next start`)으로 확인하세요.
- **프로덕션 로그인 자동검증 불가** — playwright가 secure 쿠키를 유지 못 함. 로컬 빌드본(`npx next start`)으로 검증(서버 로그 `POST /login 303 → GET / 200`이 성공 신호).
- **DB는 additive만** — blanket DELETE/TRUNCATE 절대 금지(과거 데이터 소실 사고로 구조적으로 막아둠). 마이그는 ADD COLUMN·CREATE만, 입력 행은 `source_system` 태깅으로 ETL 재실행에도 보존.

> 운영만 이어받는 사람은 앱 로그인 후 `/handoff`·`/status` 탭이면 충분합니다 — 위 개발 패키지는 개발 담당자에게 전달하세요.
