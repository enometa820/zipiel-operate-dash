import { NavTabs } from "@/components/NavTabs";
import { fetchStats, fetchLogisticsStats } from "@/lib/queries";
import { COUNTRY_FLAG, PHASES, PHASE_META, type Country } from "@/lib/types";

export const dynamic = "force-dynamic";

// 한글 개발현황 — 비개발자(매니저)도 한눈에 이해하도록
export default async function StatusPage() {
  const [stats, logi] = await Promise.all([fetchStats(), fetchLogisticsStats()]);
  const krw = (n: number) => `${n.toLocaleString()}원`;

  const countryName: Record<string, string> = {
    JP: "일본", CN: "중국", TW: "대만", KR: "한국",
    SG: "싱가폴", MY: "말레이시아", HK: "홍콩", US: "미국",
  };

  return (
    <div className="max-w-[900px] mx-auto px-5 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">개발 현황 · 작업 로그</h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">이 대시보드가 지금 무엇을 하고, 어디까지 만들어졌는지</p>
        </div>
        <NavTabs />
      </div>

      {/* 개요 */}
      <section className="card p-5 mb-4">
        <h2 className="text-sm font-semibold mb-2">이 대시보드는?</h2>
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          글로벌 인플루언서(크리에이터) 시딩·협업을 관리하는 운영 대시보드입니다. 예전에는 17개 탭짜리 구글 시트로
          손으로 관리하던 것을, <strong className="text-[var(--text)]">표준 단계 파이프라인</strong>으로 옮겨
          누가·어느 나라·어느 단계에 있는지 한눈에 보고 상태를 바꿀 수 있게 만들었습니다. 운영 언어는 영어,
          이 현황 페이지만 한글입니다.
        </p>
      </section>

      {/* 지금 데이터 */}
      <section className="card p-5 mb-4">
        <h2 className="text-sm font-semibold mb-4">지금 들어있는 데이터</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <Stat label="크리에이터" value={stats.creators.toLocaleString()} unit="명" />
          <Stat label="협업 건수" value={stats.total.toLocaleString()} unit="건" />
          <Stat label="리스트업 날짜 있음" value={stats.withListedDate.toLocaleString()} unit="건" />
          <Stat label="업로드 링크 있음" value={stats.withPostUrl.toLocaleString()} unit="건" />
        </div>

        <Bars title="진행 단계별" data={PHASES.map((p) => ({ label: p, ko: PHASE_META[p].label, n: stats.byPhase[p] ?? 0, color: PHASE_META[p].accent }))} total={stats.total} />
        <Bars
          title="국가별"
          data={Object.entries(stats.byCountry)
            .sort((a, b) => b[1] - a[1])
            .map(([c, n]) => ({ label: `${COUNTRY_FLAG[c as Country] ?? ""} ${countryName[c] ?? c}`, ko: "", n, color: "var(--accent)" }))}
          total={stats.total}
        />
        <Bars
          title="캠페인 유형별"
          data={Object.entries(stats.byCampaign)
            .sort((a, b) => b[1] - a[1])
            .map(([c, n]) => ({ label: c, ko: c === "Gifted" ? "무가(제품제공)" : c === "Paid" ? "유가(비용)" : "어필리에이트", n, color: "var(--phase-fulfillment)" }))}
          total={stats.total}
        />
      </section>

      {/* 물류·제품 원가·데이터 출처 (데이터 토대 스프린트 산출) */}
      <section className="card p-5 mb-4">
        <h2 className="text-sm font-semibold mb-4">물류·제품 원가·데이터 출처</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <Stat label="배송 송장" value={logi.shipments.toLocaleString()} unit="건" />
          <Stat label="물류비 (H&H 제외)" value={logi.feeKrwExclHH.toLocaleString()} unit="원" />
          <Stat label="물류비 (전체)" value={logi.feeKrwTotal.toLocaleString()} unit="원" />
          <Stat label="제품 원가" value={logi.products.length.toLocaleString()} unit="종" />
        </div>

        <div className="text-xs font-semibold text-[var(--muted)] mb-2">제품 원가 (COGS)</div>
        <div className="flex flex-wrap gap-2 mb-5">
          {logi.products.map((p) => (
            <span key={p.name} className="rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-2.5 py-1 text-xs">
              {p.name} · <span className="tabular-nums font-medium">{p.cogsKrw != null ? krw(p.cogsKrw) : "-"}</span>
            </span>
          ))}
          {!logi.products.length && <span className="text-xs text-[var(--faint)]">아직 없음</span>}
        </div>

        <Bars
          title="데이터 출처 (협업 행 기준)"
          data={Object.entries(logi.sourceDistribution)
            .sort((a, b) => b[1] - a[1])
            .map(([s, n]) => ({
              label: s === "legacy_contact_list" ? "기존 컨택 리스트" : s,
              ko: s === "legacy_contact_list" ? "발굴 풀(legacy)" : "",
              n,
              color: "var(--phase-sourcing)",
            }))}
          total={stats.total}
        />
        <p className="text-[11px] text-[var(--faint)] mt-3">
          모든 협업 행에 출처가 새겨져 있어, 시트를 다시 가져와도 기존 데이터·상태 이력이 지워지지 않습니다(손실 없는 증분 적재).
          물류비 기본 표기는 타브랜드(H&H)를 제외한 zipiel 발송분입니다.
        </p>
      </section>

      {/* 기능 */}
      <section className="card p-5 mb-4">
        <h2 className="text-sm font-semibold mb-3">무엇이 되나 (구현된 기능)</h2>
        <ul className="space-y-2 text-sm">
          {FEATURES.map((f) => (
            <li key={f.t} className="flex items-start gap-2">
              <span className={f.done ? "text-[var(--phase-payment)]" : "text-[var(--faint)]"}>{f.done ? "✓" : "○"}</span>
              <div>
                <span className="font-medium">{f.t}</span>
                <span className="text-[var(--muted)]"> — {f.d}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 개발 로그 */}
      <section className="card p-5">
        <h2 className="text-sm font-semibold mb-4">개발 로그 (작업 순서)</h2>
        <ol className="space-y-4">
          {LOG.map((l, i) => (
            <li key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="h-6 w-6 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                {i < LOG.length - 1 && <span className="w-px flex-1 bg-[var(--border)] mt-1" />}
              </div>
              <div className="pb-1">
                <p className="text-sm font-medium">{l.t}</p>
                <p className="text-sm text-[var(--muted)] mt-0.5">{l.d}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="text-[11px] text-[var(--faint)] mt-4">모든 변경은 GitHub에 기록되며, 푸시할 때마다 자동으로 온라인에 반영됩니다.</p>
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

function Bars({ title, data, total }: { title: string; data: { label: string; ko: string; n: number; color: string }[]; total: number }) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="text-xs font-semibold text-[var(--muted)] mb-2">{title}</div>
      <div className="space-y-1.5">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2 text-xs">
            <span className="w-28 shrink-0 truncate">{d.label}{d.ko ? ` · ${d.ko}` : ""}</span>
            <div className="flex-1 h-4 rounded bg-[var(--panel-2)] overflow-hidden">
              <div className="h-full rounded" style={{ width: `${total ? (d.n / total) * 100 : 0}%`, background: d.color, minWidth: d.n ? 2 : 0 }} />
            </div>
            <span className="w-14 text-right tabular-nums text-[var(--muted)]">{d.n.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const FEATURES = [
  { done: true, t: "6단계 파이프라인", d: "리스트업→협상→발송→콘텐츠→지급→완료 — 상태 그룹 시트 그리드로 단계별 추적(칸반은 운영팀 피드백으로 제거, 가로 스크롤 없는 시트형으로 전환)" },
  { done: true, t: "상태 직접 변경", d: "카드·상세에서 effie 정본 15단계 드롭다운으로 바로 변경, 이력 자동 기록" },
  { done: true, t: "표 보기", d: "정렬·검색·담당자/유형 필터·페이지 넘김" },
  { done: true, t: "크리에이터 상세(Deal) 페이지", d: "협업 조건·CPV·지급·상태 이력을 한 화면에" },
  { done: true, t: "날짜", d: "리스트업 날짜·최근 소통 일자·업로드 예정일" },
  { done: true, t: "지급 세금 분기", d: "외국인은 국내 3.3% 일괄 적용 안 함 — 거주지별 분기" },
  { done: true, t: "팀 로그인", d: "비밀번호로 팀만 접속" },
  { done: true, t: "정직한 금액 표기", d: "콘텐츠비는 '집행액'이 아니라 시트 제안가 — KRW가 확정된 출처만 집계하고 통화 미확인(대만 등)은 제외, 일본 참여율 오염 차단. 실제 집행 기록(지급)은 아직 0건." },
  { done: true, t: "보는/하는 화면 분리", d: "Overview(매니저용 건강도 한눈에)와 Work board(운영자가 굴리는 작업면)를 분리" },
  { done: true, t: "시트형 작업 그리드", d: "가로 스크롤 없이 화면 폭에 맞춰 협업을 시트처럼 스캔·바로 편집(상태·담당자·날짜·금액), 상태·국가·담당자·날짜 필터" },
  { done: true, t: "합산 근거 표기", d: "집계 금액·건수에 산출 근거(포함/제외 규칙·fee 원장)를 함께 표기 — 개발단계에 옳고 그름을 검산 가능하게" },
  { done: true, t: "실제 지급 입력", d: "Deal 페이지에서 지급액·거주지별 세금·상태를 기록 → Overview의 Executed fee가 시트 추정에서 실집행값으로 전환" },
  { done: true, t: "손실 없는 데이터 토대", d: "시트를 다시 가져와도 기존 데이터·상태 이력·편집이 지워지지 않는 증분 적재로 전환. 모든 행에 출처를 기록 — 작업자 입력·새 시트·크롤링 결과를 안전하게 얹을 수 있음." },
  { done: true, t: "물류비·제품 원가", d: "배송 송장(물류비)과 제품 원가(세럼·크림·클레이)를 정본 테이블로 적재 — 수익성 계산의 토대. 수취인 개인정보는 저장하지 않음." },
  { done: true, t: "온에어 실데이터 적재", d: "effie님 온에어 시트(국가별 KR·CN·JP·TW)를 실제 운영 정본으로 적재(협업 789건). 기존 컨택 리스트와 중복되는 인원은 발굴 풀로 별도 표시, 이중 계상 없이 승격." },
  { done: true, t: "콘텐츠 성과 데이터", d: "업로드된 콘텐츠의 조회수·좋아요·댓글·리포스트·북마크·공유수 + 1·3·7일차 시계열을 온에어 시트에서 적재(645건). 분석·달성률·인게이지먼트 화면의 원천 데이터." },
  { done: true, t: "성과 분석 화면", d: "일/주/월 콘텐츠 수·달성률·인게이지먼트% + 1·3·7일차 성과 추이를 국가·기간별로 시각화(/analytics)." },
  { done: true, t: "물류 운영 화면", d: "글로벌·국내 발송, 송장↔협업 매칭, 배송 상태, 물류비를 한 화면에(/logistics). 국내 송장도 적재·매칭." },
  { done: true, t: "작업자 신규 입력", d: "시트 없이 Work board에서 새 크리에이터·협업을 바로 추가. 앱 입력 행은 출처 'manual'로 새겨 시트 재적재 시 보존. 리스트업일·업로드 예정일·게시 링크도 board에서 직접 편집." },
  { done: true, t: "정체 협업 알림", d: "14일 넘게 소통 없는 진행 건을 Overview에서 경고하고 board에서 바로 걸러 보기 — 담당자가 바뀐 뒤 가장 먼저 점검할 대상." },
];

const LOG = [
  { t: "회사 시트·슬랙 조사", d: "운영 구글 시트 17개 탭과 effie님 요청을 전부 분석해 무엇을 만들지 확정" },
  { t: "대시보드 기본 구축", d: "6단계 칸반 보드 + 표 + 상세 페이지 뼈대 제작" },
  { t: "데이터베이스 연결", d: "Supabase 클라우드 연결 — 목 데이터에서 실제 데이터로 전환" },
  { t: "실데이터 적재", d: "운영 시트(한국·일본·대만·중국·싱가폴)를 표준화해 크리에이터·협업으로 투입" },
  { t: "팀 로그인·온라인 배포", d: "팀이 인터넷으로 접속하도록 로그인 추가 후 배포" },
  { t: "effie 정본 상태 일치", d: "상태 단계를 시트 드롭다운(15단계)과 글자 하나까지 동일하게 맞춤" },
  { t: "팔로워·상태편집·날짜", d: "팔로워 숫자 복구, 카드에서 상태 직접 변경, 시트 날짜 표시" },
  { t: "데이터 정합 교정", d: "콘텐츠비 출처를 국가별로 분리(KRW 확정/통화 미확인/없음) — 일본 참여율 오염 차단, 가짜 약정액(2억) 집계 제거. 담당자 표기 35종→통합(SOL·Sol→Sol 등)." },
  { t: "보는/하는 화면 분리 + 시트형 그리드", d: "Overview(건강도·시각화)와 Work board(가로 스크롤 없는 시트형 작업 그리드) 분리. 합산엔 근거 동반." },
  { t: "지급 입력 흐름", d: "Deal 페이지에 지급 기록(금액·세금분기·상태) 추가 — payments가 쌓이면 Executed fee가 실집행값으로 자동 전환." },
  { t: "로딩·속도 최적화", d: "로그인·페이지 로딩 표시. 집계는 최소 컬럼+캐시, 조회는 병렬 페이지네이션, 작업면은 기본 active만 로드(발굴 풀은 토글 시) — Overview 2.6s→0.7s, 작업면 5.4s→0.1s." },
  { t: "손실 없는 데이터 토대 + 물류·원가", d: "ETL 전량삭제를 멱등 증분 적재로 교체(재실행해도 데이터·이력 보존), 모든 행에 출처 기록. 배송 송장(물류비)·제품 원가 테이블 신설·적재. 상태 라벨 'On Hold'→'Payment Pending' 정정." },
  { t: "품질 강화 (정직성·복원력·접근성·테스트)", d: "KPI 정직성(실집행 게이트·출처불명 금액 포착)·이중언어 라벨 정합·성능(쿼리 병렬·인덱스)·지급 날짜 손실 버그 수정·에러 화면·키보드 접근성·단위 테스트(16건)를 보강." },
  { t: "원본 100% 추출·해석", d: "온에어·배송·참조 시트(총 60여 탭)와 슬랙 스펙을 빠짐없이 추출·해석해 백로그와 시트 재현 우선 화면 설계를 확정. 빠진 탭(국내 송장 등)·잘못된 가정을 적재 전에 교정." },
  { t: "온에어 실데이터 적재", d: "온에어 시트(국가별)를 운영 정본으로 적재 — 협업 789건·콘텐츠 성과 645건. 기존 데이터·이력·편집을 지우지 않는 손실 없는 적재로, 분석 화면의 원천 마련." },
  { t: "성과 분석 화면", d: "적재한 성과 데이터를 일/주/월 콘텐츠 수·달성률·인게이지먼트(%)·1·3·7일차 추이로 시각화(/analytics). 국가·기간 토글, 빈 데이터는 정직하게 표기." },
  { t: "국내 송장 적재·물류 화면", d: "국내 송장을 적재하고 송장↔협업을 연결(매칭)한 뒤, 발송·매칭·배송 상태·물류비를 물류 운영 화면(/logistics)으로 노출." },
  { t: "작업자 신규 입력·편집 확장", d: "시트 없이 board에서 새 크리에이터·협업을 직접 추가(앱 입력 행은 출처 'manual'로 보존). 리스트업일·업로드 예정일·게시 링크를 board에서 바로 편집." },
  { t: "정체 협업 알림", d: "14일 넘게 소통 없는 진행 건을 Overview에서 경고하고 board에서 바로 걸러 보게 함 — 담당자 인계 후 방치되는 건을 막기 위해." },
];
