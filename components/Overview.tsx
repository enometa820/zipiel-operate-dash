import { formatKrw } from "@/lib/utils";
import { COUNTRY_FLAG, PHASE_META, type Country, type Phase } from "@/lib/types";
import type { OverviewStats } from "@/lib/queries";

const CAMPAIGN_COLOR: Record<string, string> = {
  Gifted: "#0ea5e9",
  Paid: "#f59e0b",
  Affiliate: "#8b5cf6",
};

// Overview (보는 화면) — 가장 중요한 화면. 전체를 한눈에 보고 의사결정.
// 정직 KPI + 의사결정용 시각화. 가짜 약정액 없음, 합산은 근거 동반.
export function Overview({ stats }: { stats: OverviewStats }) {
  const negotiating = stats.funnel.find((f) => f.phase === "Negotiation")?.count ?? 0;

  // 전 단계 분포(스택바·범례) — 발굴풀이 압도적임을 정직하게 보여줌
  const dist = [
    { label: "Sourcing", count: stats.discoveryPool, color: PHASE_META.Sourcing.accent },
    ...stats.funnel.map((s) => ({ label: s.phase, count: s.count, color: PHASE_META[s.phase as Phase].accent })),
    { label: "Dropped", count: stats.dropped, color: PHASE_META.Dropped.accent },
  ].filter((s) => s.count > 0);
  const distTotal = dist.reduce((a, s) => a + s.count, 0) || 1;

  // 전환율 — 의사결정 지표
  const convActive = stats.discoveryPool ? (stats.activePipeline / stats.discoveryPool) * 100 : 0;
  const convContent = stats.activePipeline ? (stats.contentLive / stats.activePipeline) * 100 : 0;

  const countries = Object.entries(stats.byCountryActive).sort((a, b) => b[1] - a[1]);
  const managers = Object.entries(stats.byManagerActive).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const campaigns = Object.entries(stats.byCampaignActive).sort((a, b) => b[1] - a[1]);
  const activeMax = Math.max(1, stats.activePipeline);

  return (
    <div className="space-y-5">
      {/* 운영 건강도 KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Active pipeline" sub="Past sourcing, not dropped" value={f(stats.activePipeline)} accent />
        <Kpi label="In negotiation" sub="Deals being negotiated" value={f(negotiating)} tone="warn" />
        <Kpi label="Content live" sub="Uploaded or completed" value={f(stats.contentLive)} />
        <Kpi label="Discovery pool" sub="Sourcing — not yet active" value={f(stats.discoveryPool)} tone="muted" />
      </div>

      {/* 정직한 금액 — 집행 vs 제안 분리 */}
      <div className="card p-5">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="text-xs text-[var(--muted)]">Executed fee</div>
            <div className="text-3xl font-bold tabular-nums mt-1">{formatKrw(stats.executedFeeKrw)}</div>
            <div className="text-xs text-[var(--muted)] mt-1">
              Paid campaigns, content live or completed · {stats.executedFeeCount} deal{stats.executedFeeCount === 1 ? "" : "s"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-[var(--muted)]">Pipeline value (proposed)</div>
            <div className="text-xl font-semibold tabular-nums mt-1">{formatKrw(stats.pipelineValueKrw)}</div>
            <div className="text-[11px] text-[var(--faint)]">{stats.pipelineValueCount} deals · not committed spend</div>
          </div>
        </div>
        {stats.paymentsRecorded === 0 && (
          <div
            className="mt-3 inline-block text-[11px] rounded-md px-2.5 py-1"
            style={{ color: "var(--phase-negotiation)", border: "1px solid var(--phase-negotiation)" }}
          >
            No payments recorded yet — figures derived from sheet content fees, not bank records.
          </div>
        )}
        <p className="text-[11px] text-[var(--faint)] mt-2">
          Trusted KRW sources only · excludes Japan &amp; Taiwan fees (source column unverified).
        </p>
      </div>

      {/* HERO: 파이프라인 분포 — 전체를 한눈에 */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Pipeline distribution</h2>
          <span className="text-[11px] text-[var(--faint)]">{f(distTotal)} collaborations</span>
        </div>
        {/* 스택 바 */}
        <div className="flex h-7 w-full rounded-lg overflow-hidden border border-[var(--border)]">
          {dist.map((s) => (
            <div
              key={s.label}
              title={`${s.label}: ${f(s.count)} (${((s.count / distTotal) * 100).toFixed(1)}%)`}
              style={{ width: `${(s.count / distTotal) * 100}%`, background: s.color, minWidth: 3 }}
            />
          ))}
        </div>
        {/* 범례 */}
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
          {dist.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5 text-xs">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
              <span className="text-[var(--muted)]">{s.label}</span>
              <span className="font-semibold tabular-nums">{f(s.count)}</span>
              <span className="text-[var(--faint)]">{((s.count / distTotal) * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
        {/* 전환율 */}
        <div className="flex flex-wrap gap-x-8 gap-y-2 mt-4 pt-3 border-t border-[var(--border)]">
          <Conv label="Sourcing → Active" value={`${convActive.toFixed(1)}%`} sub={`${f(stats.activePipeline)} of ${f(stats.discoveryPool)}`} />
          <Conv label="Active → Content live" value={`${convContent.toFixed(1)}%`} sub={`${f(stats.contentLive)} of ${f(stats.activePipeline)}`} />
          <Conv label="Completed" value={f(stats.funnel.find((s) => s.phase === "Done")?.count ?? 0)} sub="reached Done" />
        </div>
      </div>

      {/* 분포 시각화 — 어디에 자원이 몰려 있나 */}
      <div className="grid md:grid-cols-3 gap-3">
        <ChartCard title="Active by country">
          {countries.length ? (
            countries.map(([c, n]) => (
              <Bar key={c} label={`${COUNTRY_FLAG[c as Country] ?? ""} ${c}`} n={n} max={activeMax} color="var(--accent)" />
            ))
          ) : (
            <Empty />
          )}
        </ChartCard>
        <ChartCard title="Active by manager">
          {managers.length ? managers.map(([m, n]) => <Bar key={m} label={m} n={n} max={activeMax} color="var(--phase-fulfillment)" />) : <Empty />}
        </ChartCard>
        <ChartCard title="Active by campaign type">
          {campaigns.length ? (
            campaigns.map(([t, n]) => <Bar key={t} label={t} n={n} max={activeMax} color={CAMPAIGN_COLOR[t] ?? "var(--accent)"} />)
          ) : (
            <Empty />
          )}
        </ChartCard>
      </div>

      {/* 근거(개발단계 검증용) — 합산이 무엇을 포함/제외했는지, 검산 가능하게 */}
      <details className="card p-4 text-xs">
        <summary className="cursor-pointer font-semibold text-[var(--muted)]">Data basis · how each number is derived (dev)</summary>
        <div className="mt-3 space-y-2">
          <BasisRow k="Counts" v={`total ${f(stats.total)} = active ${f(stats.activePipeline)} + discovery pool ${f(stats.discoveryPool)} + dropped ${f(stats.dropped)}`} />
          <BasisRow k="Active pipeline" v="status ≠ Drop and phase ≠ Sourcing. Discovery pool = Sourcing phase." />
          <BasisRow k="Executed fee" v={`${stats.executedFeeCount} deal(s) = ${formatKrw(stats.executedFeeKrw)} — Paid campaign · status Content Uploaded/Completed · trusted-KRW source only`} />
          <BasisRow k="Pipeline value" v={`${stats.pipelineValueCount} deals = ${formatKrw(stats.pipelineValueKrw)} — active · trusted-KRW fee · proposed price (not committed/paid)`} />
          <BasisRow
            k="Fee ledger (all rows)"
            v={`trusted KRW ${stats.feeLedger.sheetKrw.count} = ${formatKrw(stats.feeLedger.sheetKrw.sum)} (KR/CN/On-Air/SGP) · unverified ${stats.feeLedger.unverified.count} = ${formatKrw(stats.feeLedger.unverified.sum)} (TW/HK/US — excluded) · no fee ${f(stats.feeLedger.noFee)} (incl. JP — engagement-rate column is not a fee)`}
          />
          <BasisRow k="Payments table" v={`${stats.paymentsRecorded} rows — actual disbursement not yet recorded.`} />
          <BasisRow k="Source" v="Live Supabase, re-derived on every load. Cross-check with scripts/diagnose_fees.py." />
        </div>
      </details>
    </div>
  );
}

function f(n: number): string {
  return n.toLocaleString();
}

function Kpi({ label, sub, value, accent, tone }: { label: string; sub: string; value: string; accent?: boolean; tone?: "muted" | "warn" }) {
  const color = tone === "warn" ? "var(--phase-negotiation)" : accent ? "var(--accent)" : tone === "muted" ? "var(--faint)" : "var(--text)";
  return (
    <div className="card p-4">
      <div className="text-xs text-[var(--muted)]">{label}</div>
      <div className="text-2xl font-bold mt-1 tabular-nums" style={{ color }}>
        {value}
      </div>
      <div className="text-[11px] text-[var(--faint)] mt-0.5">{sub}</div>
    </div>
  );
}

function Conv({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <div className="text-[11px] text-[var(--muted)]">{label}</div>
      <div className="text-lg font-bold tabular-nums">{value}</div>
      <div className="text-[10px] text-[var(--faint)]">{sub}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-semibold text-[var(--muted)] mb-3">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Bar({ label, n, max, color }: { label: string; n: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 shrink-0 truncate" title={label}>{label}</span>
      <div className="flex-1 h-4 rounded bg-[var(--panel-2)] overflow-hidden">
        <div className="h-full rounded" style={{ width: `${(n / max) * 100}%`, background: color, minWidth: n ? 2 : 0 }} />
      </div>
      <span className="w-12 text-right tabular-nums text-[var(--muted)]">{n.toLocaleString()}</span>
    </div>
  );
}

function Empty() {
  return <div className="text-[11px] text-[var(--faint)] py-3 text-center">No active items</div>;
}

function BasisRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-3">
      <span className="font-medium text-[var(--muted)] sm:w-36 shrink-0">{k}</span>
      <span className="text-[var(--faint)]">{v}</span>
    </div>
  );
}
