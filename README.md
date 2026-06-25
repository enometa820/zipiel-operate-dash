# zipiel · Seeding Ops

(주)더프레임리스 브랜드 **zipiel**의 **마케팅 오퍼레이션 대시보드** — 1차 도메인은 글로벌 인플루언서 시딩·협업 파이프라인 관리(영어 운영). 같은 회사 `zipiel-cs-demo`(광고·매출 대시보드)와 도메인이 달라 분리된 repo.

## 무엇

기존에 17탭짜리 구글시트로 수기 관리하던 글로벌 인플루언서 시딩 협업을, **표준화된 상태 파이프라인 대시보드**로 대체한다. 크리에이터 발굴(크롤링)은 별도 시스템 소관 — 이 대시보드는 **협업 상태 관리·통합·성과·지급**에 집중한다.

- **6페이즈 칸반** (Sourcing → Negotiation → Fulfillment → Content → Payment → Done, + Dropped) — 15단계 세부 상태를 6컬럼으로 접음
- **칸반 ↔ 테이블 하이브리드** 토글 (같은 데이터, 드래그로 상태 이동 / 필터·정렬·비교)
- **Deal Page** — 크리에이터 단일 통합 뷰 (조건·지급·세금 분기·상태 타임라인)

## 실행

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # 프로덕션 빌드
```

현재는 **목 데이터**(`lib/data.ts`, 가짜 크리에이터)로 동작한다. Supabase 연결 전 단계.

## 구조

| 경로 | 무엇 |
| --- | --- |
| `app/page.tsx` | 대시보드 홈 (KPI + 칸반/테이블) |
| `app/collaborations/[id]/` | Deal Page (크리에이터 단일 뷰) |
| `components/` | 칸반·테이블·카드·배지 |
| `lib/types.ts` | 도메인 모델·상태머신(Status→Phase) |
| `lib/data.ts` | 목 데이터 + 접근 함수 (→ Supabase로 교체 예정) |
| `db/migrations/0001_init.sql` | 6테이블 스키마·상태 enum·RLS·전이 트리거 |
| `research/` | **조사 답안지** — `00-조사-종합.md` + 시트 17탭 스냅샷(PII, gitignore) |

## 데이터 모델

`creators`(마스터) → `campaigns` → `collaborations`(현재 상태 보유) → `collaboration_status_history`(전이 이력) → `content_pieces`(성과) → `payments`(지급).
현재 상태는 본체에, 전이는 append-only 이력에 분리 → 단계별 리드타임 분석이 공짜.

## 주의

- **세금**: 외국인 크리에이터에 한국 3.3% 일괄 적용 금지. 자국서 콘텐츠 제작=국외 수행이라 원천징수 의무 없음(총액 지급)이 일반 원칙. `payments.tax_type`으로 분기. (근거 = `research/00-조사-종합.md` §8)
- **PII**: 크리에이터 이메일·배송 주소·전화는 RLS·최소권한으로 보호. 실데이터 시트 스냅샷은 gitignore.

조사 배경·의사결정 근거는 `research/00-조사-종합.md`가 정본.
