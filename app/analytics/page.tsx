import { NavTabs } from "@/components/NavTabs";
import { fetchAnalytics } from "@/lib/queries";
import { GRAINS, type Grain } from "@/lib/analytics";
import Link from "next/link";

export const dynamic = "force-dynamic";

const GRAIN_LABEL: Record<Grain, string> = { day: "Daily", week: "Weekly", month: "Monthly" };

// 성과 분석 — 온에어 콘텐츠 발행·달성률·인게이지먼트. 운영 언어 영어(시트 정본 정합).
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ grain?: string; country?: string }>;
}) {
  const sp = await searchParams;
  const grain: Grain = GRAINS.includes(sp.grain as Grain) ? (sp.grain as Grain) : "month";
  const country = sp.country || "all";
  const a = await fetchAnalytics(grain, country);
  const m = a.matrix;
  const countryOpts = ["all", ...a.countriesAvailable];
  const pctText = (v: number | null) => (v == null ? "—" : `${v}%`);

  return (
    <div className="max-w-[1100px] mx-auto px-5 py-6">
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Analytics</h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">Content output, achievement rate, and engagement from on-air data</p>
        </div>
        <NavTabs />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <Toggle label="Period">
          {GRAINS.map((g) => (
            <Seg key={g} href={`/analytics?grain=${g}&country=${country}`} active={g === grain}>
              {GRAIN_LABEL[g]}
            </Seg>
          ))}
        </Toggle>
        <Toggle label="Country">
          {countryOpts.map((c) => (
            <Seg key={c} href={`/analytics?grain=${grain}&country=${c}`} active={c === country}>
              {c === "all" ? "All" : c}
            </Seg>
          ))}
        </Toggle>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="Posts published" value={a.summary.totalPosted.toLocaleString()} sub={`${GRAIN_LABEL[grain].toLowerCase()} · ${country === "all" ? "all countries" : country}`} />
        <Stat label="Achievement rate" value={pctText(a.summary.achievementRate)} sub={`${a.achievement.posted} / ${a.achievement.scheduled} of scheduled`} />
        <Stat label="Avg engagement" value={a.summary.avgEngagementPct == null ? "—" : `${a.summary.avgEngagementPct}%`} sub={`from ${a.summary.engagementCollected} / ${a.summary.engagementTotal} with views`} />
        <Stat label="Active countries" value={a.summary.activeCountries.toLocaleString()} sub="with published content" />
      </div>

      {a.summary.totalPosted === 0 ? (
        <section className="card p-8 text-center text-sm text-[var(--muted)]">
          No published content in this view. Try a different period or country.
        </section>
      ) : (
        <>
          {/* Matrix: period × product */}
          <section className="card p-5 mb-4 overflow-x-auto">
            <h2 className="text-sm font-semibold mb-3">Output matrix · {GRAIN_LABEL[grain]} × product</h2>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[var(--muted)] border-b border-[var(--border)]">
                  <th className="text-left font-semibold py-1.5 pr-3">Period</th>
                  {m.products.map((p) => (
                    <th key={p} className="text-right font-semibold py-1.5 px-2 tabular-nums">{p}</th>
                  ))}
                  <th className="text-right font-semibold py-1.5 pl-2 tabular-nums">Total</th>
                </tr>
              </thead>
              <tbody>
                {m.buckets.map((b) => (
                  <tr key={b} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-1.5 pr-3 font-medium whitespace-nowrap">{b}</td>
                    {m.products.map((p) => (
                      <td key={p} className="text-right py-1.5 px-2 tabular-nums text-[var(--muted)]">{m.cells[b]?.[p] ?? 0}</td>
                    ))}
                    <td className="text-right py-1.5 pl-2 tabular-nums font-semibold">{m.bucketTotals[b]}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[var(--border-strong)] font-semibold">
                  <td className="py-1.5 pr-3">Total</td>
                  {m.products.map((p) => (
                    <td key={p} className="text-right py-1.5 px-2 tabular-nums">{m.productTotals[p] ?? 0}</td>
                  ))}
                  <td className="text-right py-1.5 pl-2 tabular-nums">{m.grandTotal}</td>
                </tr>
              </tfoot>
            </table>
          </section>

          <div className="grid md:grid-cols-2 gap-4 mb-4">
            {/* Achievement rate — by period (grain) + by country */}
            <section className="card p-5">
              <h2 className="text-sm font-semibold mb-1">Achievement rate</h2>
              <p className="text-[11px] text-[var(--faint)] mb-3">Published vs scheduled (— = none scheduled)</p>
              <div className="text-[11px] font-semibold text-[var(--muted)] mb-1.5">By {GRAIN_LABEL[grain].toLowerCase().replace("ly", "")}</div>
              <div className="space-y-1.5 mb-3">
                {a.achievement.byBucket.map((r) => (
                  <Row key={r.bucket} label={r.bucket} barPct={r.rate ?? 0} value={`${pctText(r.rate)} · ${r.posted}/${r.scheduled}`} color="var(--phase-payment)" />
                ))}
                {!a.achievement.byBucket.length && <Empty />}
              </div>
              <div className="text-[11px] font-semibold text-[var(--muted)] mb-1.5">By country</div>
              <div className="space-y-1.5">
                {a.achievement.byCountry.map((r) => (
                  <Row key={r.country} label={r.country} barPct={r.rate ?? 0} value={`${pctText(r.rate)} · ${r.posted}/${r.scheduled}`} color="var(--phase-payment)" />
                ))}
                {!a.achievement.byCountry.length && <Empty />}
              </div>
            </section>

            {/* Engagement by country */}
            <section className="card p-5">
              <h2 className="text-sm font-semibold mb-1">Engagement by country</h2>
              <p className="text-[11px] text-[var(--faint)] mb-3">(likes+comments+reposts+saves+shares) / views · only posts with views</p>
              <div className="space-y-1.5">
                {a.engagement.byCountry.map((r) => (
                  <Row key={r.country} label={r.country} barPct={Math.min((r.avgPct ?? 0) * 5, 100)} value={`${r.avgPct == null ? "—" : `${r.avgPct}%`} · n=${r.collected}`} color="var(--accent)" />
                ))}
                {!a.engagement.byCountry.length && <Empty note="No view data collected yet" />}
              </div>
            </section>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Country × product */}
            <section className="card p-5 overflow-x-auto">
              <h2 className="text-sm font-semibold mb-3">Country × product (published)</h2>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[var(--muted)] border-b border-[var(--border)]">
                    <th className="text-left font-semibold py-1.5 pr-3">Country</th>
                    {a.countryProduct.products.map((p) => (
                      <th key={p} className="text-right font-semibold py-1.5 px-2">{p}</th>
                    ))}
                    <th className="text-right font-semibold py-1.5 pl-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {a.countryProduct.countries.map((c) => (
                    <tr key={c} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-1.5 pr-3 font-medium">{c}</td>
                      {a.countryProduct.products.map((p) => (
                        <td key={p} className="text-right py-1.5 px-2 tabular-nums text-[var(--muted)]">{a.countryProduct.cells[c]?.[p] ?? 0}</td>
                      ))}
                      <td className="text-right py-1.5 pl-2 tabular-nums font-semibold">{a.countryProduct.countryTotals[c]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* Country × tier */}
            <section className="card p-5 overflow-x-auto">
              <h2 className="text-sm font-semibold mb-1">Country × creator tier</h2>
              <p className="text-[11px] text-[var(--faint)] mb-3">by content piece</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[var(--muted)] border-b border-[var(--border)]">
                    <th className="text-left font-semibold py-1.5 pr-3">Country</th>
                    {a.countryTier.tiers.map((t) => (
                      <th key={t} className="text-right font-semibold py-1.5 px-2">{t}</th>
                    ))}
                    <th className="text-right font-semibold py-1.5 pl-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {a.countryTier.countries.map((c) => (
                    <tr key={c} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-1.5 pr-3 font-medium">{c}</td>
                      {a.countryTier.tiers.map((t) => (
                        <td key={t} className="text-right py-1.5 px-2 tabular-nums text-[var(--muted)]">{a.countryTier.cells[c]?.[t] ?? 0}</td>
                      ))}
                      <td className="text-right py-1.5 pl-2 tabular-nums font-semibold">{a.countryTier.countryTotals[c]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>

          <p className="text-[11px] text-[var(--faint)] mt-4">
            Source: on-air content_pieces (onair_2026). Engagement uses only posts with view data ({a.summary.engagementCollected} of {a.summary.engagementTotal}); the rest have no views collected yet. Time-series (day 1/3/7) parsing is a later step.
          </p>
        </>
      )}
    </div>
  );
}

function Toggle({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[var(--muted)]">{label}</span>
      <div className="inline-flex rounded-lg border border-[var(--border-strong)] overflow-hidden">{children}</div>
    </div>
  );
}

function Seg({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`px-3 py-1 text-xs font-semibold transition-colors ${
        active ? "bg-[var(--accent)] text-white" : "bg-[var(--panel)] text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--panel-2)]"
      }`}
    >
      {children}
    </Link>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-3">
      <div className="text-xs text-[var(--muted)]">{label}</div>
      <div className="text-2xl font-bold mt-1 tabular-nums">{value}</div>
      <div className="text-[11px] text-[var(--faint)] mt-0.5">{sub}</div>
    </div>
  );
}

function Row({ label, barPct, value, color }: { label: string; barPct: number; value: string; color: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 shrink-0 font-medium truncate" title={label}>{label}</span>
      <div className="flex-1 h-4 rounded bg-[var(--panel-2)] overflow-hidden">
        <div className="h-full rounded" style={{ width: `${Math.max(0, Math.min(barPct, 100))}%`, background: color, minWidth: barPct ? 2 : 0 }} />
      </div>
      <span className="w-28 text-right tabular-nums text-[var(--muted)]">{value}</span>
    </div>
  );
}

function Empty({ note = "No data" }: { note?: string }) {
  return <p className="text-xs text-[var(--faint)]">{note}</p>;
}
