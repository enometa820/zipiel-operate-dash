import { NavTabs } from "@/components/NavTabs";
import { fetchStats, fetchLogisticsStats } from "@/lib/queries";

export const dynamic = "force-dynamic";

// 인수인계 — 이 프로젝트를 이어받는 사람이 앱만 보고도 현황·다음 할 일·지킬 규칙을 파악하도록.
// 작업 방식(내부 운영 표현)이 아니라 "무엇이 만들어졌고 무엇을 왜 이어가야 하는지"를 적는다.
export default async function HandoffPage() {
  const [stats, logi] = await Promise.all([fetchStats(), fetchLogisticsStats()]);
  const onair = logi.sourceDistribution["onair_2026"] ?? 0;
  const legacy = logi.sourceDistribution["legacy_contact_list"] ?? 0;

  return (
    <div className="max-w-[900px] mx-auto px-5 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">인수인계</h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">이 프로젝트를 이어받는 사람을 위한 안내 — 무엇이 만들어졌고, 다음에 무엇을 할지</p>
        </div>
        <NavTabs />
      </div>

      {/* 한눈에 */}
      <section className="card p-5 mb-4">
        <h2 className="text-sm font-semibold mb-2">한눈에</h2>
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          zipiel의 <strong className="text-[var(--text)]">글로벌 인플루언서 시딩·협업 운영 대시보드</strong>입니다.
          예전에는 여러 탭짜리 구글 시트로 손으로 관리하던 협업을, 표준 단계 파이프라인으로 옮겨
          누가·어느 나라·어느 단계에 있는지 한눈에 보고 상태를 바꿀 수 있게 만들었습니다.
          운영 언어는 영어이며, 이 인수인계와 개발 현황 페이지만 한글입니다.
        </p>
      </section>

      {/* 지금 상태 */}
      <section className="card p-5 mb-4">
        <h2 className="text-sm font-semibold mb-4">지금 들어있는 데이터</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="협업 건수" value={stats.total.toLocaleString()} unit="건" />
          <Stat label="크리에이터" value={stats.creators.toLocaleString()} unit="명" />
          <Stat label="온에어 정본" value={onair.toLocaleString()} unit="건" />
          <Stat label="발굴 풀(기존 리스트)" value={legacy.toLocaleString()} unit="건" />
        </div>
        <p className="text-[11px] text-[var(--faint)] mt-3">
          온에어 정본 = effie님 온에어 시트(국가별)에서 가져온 실제 운영 데이터. 발굴 풀 = 예전 컨택 리스트로,
          중복 인원은 이중으로 세지 않고 온에어 쪽으로 승격했습니다. 모든 행에 출처가 새겨져 있어, 시트를 다시 가져와도
          기존 데이터·상태 이력·편집이 지워지지 않습니다.
        </p>
      </section>

      {/* 기술 구성 */}
      <section className="card p-5 mb-4">
        <h2 className="text-sm font-semibold mb-3">기술 구성</h2>
        <ul className="space-y-2 text-sm">
          {STACK.map((s) => (
            <li key={s.t} className="flex items-start gap-2">
              <span className="text-[var(--accent)]">·</span>
              <div>
                <span className="font-medium">{s.t}</span>
                <span className="text-[var(--muted)]"> — {s.d}</span>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-[var(--faint)] mt-3">
          데이터 흐름: 운영 시트 → 적재 스크립트(정규화·출처 태깅) → 데이터베이스 → 화면. 상태를 바꾸면 이력이 자동으로 기록됩니다.
        </p>
      </section>

      {/* 어디까지 했나 */}
      <section className="card p-5 mb-4">
        <h2 className="text-sm font-semibold mb-3">어디까지 했나 (완료)</h2>
        <ul className="space-y-2 text-sm">
          {DONE.map((d) => (
            <li key={d} className="flex items-start gap-2">
              <span className="text-[var(--phase-payment)]">✓</span>
              <span className="text-[var(--muted)]">{d}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 다음 할 일 */}
      <section className="card p-5 mb-4">
        <h2 className="text-sm font-semibold mb-3">다음 할 일 (우선순위 순)</h2>
        <ol className="space-y-3">
          {NEXT.map((n, i) => (
            <li key={n.t} className="flex gap-3">
              <span className="h-6 w-6 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
              <div>
                <p className="text-sm font-medium">{n.t}</p>
                <p className="text-sm text-[var(--muted)] mt-0.5">{n.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* 지킬 규칙 */}
      <section className="card p-5">
        <h2 className="text-sm font-semibold mb-3">이어받을 때 꼭 지킬 것</h2>
        <ul className="space-y-2 text-sm">
          {RULES.map((r) => (
            <li key={r.t} className="flex items-start gap-2">
              <span className="text-[var(--phase-payment)]">!</span>
              <div>
                <span className="font-medium">{r.t}</span>
                <span className="text-[var(--muted)]"> — {r.d}</span>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-[var(--faint)] mt-4">
          더 자세한 작업 기록·결정 이력·실행 방법은 프로젝트 저장소의 문서에 정리돼 있습니다. 이 페이지는 큰 그림과 현재 상태를 빠르게 잡기 위한 것입니다.
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-3">
      <div className="text-xs text-[var(--muted)]">{label}</div>
      <div className="text-xl font-bold mt-1 tabular-nums">
        {value}
        <span className="text-xs font-normal text-[var(--muted)] ml-0.5">{unit}</span>
      </div>
    </div>
  );
}

const STACK = [
  { t: "프론트엔드", d: "Next.js(App Router)·React·Tailwind. 화면은 서버에서 데이터를 받아 렌더링" },
  { t: "데이터베이스", d: "Supabase(클라우드 Postgres). 환경변수로 연결, 접근값은 저장소 밖에서 주입" },
  { t: "데이터 적재", d: "운영 시트를 읽어 표준화하는 적재 스크립트. 같은 시트를 다시 가져와도 기존 데이터가 보존되는 증분 방식" },
  { t: "인증·배포", d: "팀 비밀번호 로그인으로 접속 제한. 저장소에 올리면 자동으로 온라인에 반영" },
];

const DONE = [
  "6단계 파이프라인(리스트업→협상→발송→콘텐츠→지급→완료) — 상태 그룹 시트 그리드로 단계별 추적, 상태 직접 변경·이력 자동 기록",
  "보는 화면(Overview, 매니저용 건강도)과 하는 화면(Work board, 운영자 작업면) 분리. 크리에이터 상세(Deal) 페이지",
  "작업자 신규 입력 — 시트 없이 Work board에서 새 크리에이터·협업을 바로 추가. 앱에서 넣은 행은 출처를 'manual'로 새겨 시트를 다시 가져와도 지워지지 않습니다. 리스트업일·업로드 예정일·게시 링크도 board에서 직접 편집",
  "정체 협업 알림 — 14일 넘게 소통이 없는 진행 건을 Overview에서 경고하고, board에서 'Needs attention only'로 바로 걸러 봅니다(담당자가 바뀐 뒤 가장 먼저 점검할 대상)",
  "성과 분석 화면(/analytics) — 일/주/월 콘텐츠 수·달성률·인게이지먼트(%)·1·3·7일차 성과 추이를 국가·기간별로 시각화",
  "물류 운영 화면(/logistics) — 글로벌·국내 발송, 송장↔협업 매칭, 배송 상태, 물류비를 한 화면에",
  "손실 없는 데이터 토대 — 시트를 다시 가져와도 데이터·이력·편집 보존. 모든 행에 출처 기록(온에어 정본 / 발굴 풀 / 작업자 입력 / 향후 크롤링 결과를 안전하게 구분)",
  "온에어 실데이터 적재 — 국가별 온에어 시트를 운영 정본으로. 기존 리스트와 중복되는 인원은 이중 계상 없이 온에어로 승격. 콘텐츠 성과(조회·좋아요·댓글·1·3·7일차) 적재",
  "물류비·제품 원가 적재(수익성 계산 토대), 정직한 금액 표기(확정 출처만 집계·통화 미확인 제외), 지급 세금 거주지별 분기",
];

const NEXT = [
  { t: "캠페인 단위 관리", d: "지금은 캠페인 이름을 텍스트로만 보존합니다. 브랜드×국가×목표로 캠페인을 구조화하면 목표 대비 달성률을 자동 계산할 수 있습니다. 시작하려면 캠페인별 목표(인원·예산·기간) 기준표가 필요합니다." },
  { t: "국내 물류비 완성", d: "국내 송장은 적재돼 협업과 연결됐지만, 배송비 칸이 원본 시트에 없어 비용은 비어 있습니다. 출고·요금 자료가 들어오면 국내 물류비·수익성이 완성됩니다." },
  { t: "성과 추이 정밀화", d: "현재 1·3·7일차 추이는 시점별로 집계 모수가 다릅니다. 같은 협업을 시점에 걸쳐 추적하는 동일 코호트 곡선으로 다듬으면 성장 해석이 더 정확해집니다." },
];

const RULES = [
  { t: "데이터를 지우지 않기", d: "적재는 항상 기존 데이터·상태 이력·사람이 손으로 고친 값을 보존하는 방식만 사용합니다. 전체 삭제 후 다시 넣는 방식은 금지입니다." },
  { t: "개인정보 보호", d: "크리에이터 이메일·이름·주소·전화 같은 개인정보는 화면에 그대로 내보내거나 외부로 옮기지 않습니다. 콘텐츠·성과 데이터에는 개인정보를 두지 않습니다." },
  { t: "데이터베이스 변경은 더하기만", d: "컬럼·테이블 추가는 괜찮지만, 기존 것을 지우거나 대량 삭제하는 변경은 사람 확인 없이 하지 않습니다." },
  { t: "운영 언어는 영어", d: "운영자가 쓰는 화면 문구는 영어로 맞춥니다(시트 정본과 일치). 한글은 이 인수인계·개발 현황 페이지에만 씁니다." },
  { t: "세금은 거주지별 분기", d: "외국인 크리에이터에게 한국 3.3%를 일괄 적용하지 않습니다. 거주지·수행지에 따라 다르므로 분기 처리합니다(실제 규정은 세무사 확인)." },
];
