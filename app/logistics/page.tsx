import { NavTabs } from "@/components/NavTabs";
import { fetchLogistics } from "@/lib/queries";

export const dynamic = "force-dynamic";

// 물류 운영 가시성 — 발송 현황·매칭·배송 상태. 운영 영어. 정직 표기(국내 물류비 미수집·매칭률 투명).
export default async function LogisticsPage() {
  const l = await fetchLogistics();
  const krw = (n: number) => `₩${n.toLocaleString()}`;
  const matchRate = l.total ? Math.round((l.matched / l.total) * 1000) / 10 : 0;

  return (
    <div className="max-w-[1000px] mx-auto px-5 py-6">
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Logistics</h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">Shipment volume, carriers, delivery status, and collaboration matching</p>
        </div>
        <NavTabs />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="Shipments" value={l.total.toLocaleString()} sub={`${l.global} global · ${l.domestic} domestic`} />
        <Stat label="Matched to collab" value={`${matchRate}%`} sub={`${l.matched} waybills · ${l.matchedCollabs} collabs`} />
        <Stat label="Global logistics fee" value={krw(l.feeGlobalKrw)} sub={`excl. H&H ${krw(l.feeExclHHKrw)}`} />
        <Stat label="Domestic fee" value="—" sub={l.domesticFeeMissing ? "not collected in sheet" : "no fee column"} />
      </div>

      {l.total === 0 ? (
        <section className="card p-8 text-center text-sm text-[var(--muted)]">No shipment data.</section>
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <section className="card p-5">
              <h2 className="text-sm font-semibold mb-3">By destination</h2>
              <Bars data={l.byCountry.map((c) => ({ label: c.label, n: c.n }))} total={l.total} color="var(--accent)" />
            </section>
            <section className="card p-5">
              <h2 className="text-sm font-semibold mb-1">By carrier</h2>
              <p className="text-[11px] text-[var(--faint)] mb-3">fee shown where collected (global only)</p>
              <div className="space-y-1.5">
                {l.byCarrier.map((c) => (
                  <div key={c.carrier} className="flex items-center gap-2 text-xs">
                    <span className="w-24 shrink-0 truncate font-medium" title={c.carrier}>{c.carrier}</span>
                    <div className="flex-1 h-4 rounded bg-[var(--panel-2)] overflow-hidden">
                      <div className="h-full rounded" style={{ width: `${(c.n / l.total) * 100}%`, background: "var(--phase-fulfillment)", minWidth: c.n ? 2 : 0 }} />
                    </div>
                    <span className="w-28 text-right tabular-nums text-[var(--muted)]">
                      {c.n} {c.feeKrw > 0 && <span className="text-[var(--faint)]">· ₩{c.feeKrw.toLocaleString()}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <section className="card p-5">
              <h2 className="text-sm font-semibold mb-3">Delivery status</h2>
              <Bars data={l.byStatus.map((s) => ({ label: s.status, n: s.n }))} total={l.total} color="var(--phase-payment)" />
            </section>
            <section className="card p-5">
              <h2 className="text-sm font-semibold mb-1">Collaboration matching</h2>
              <p className="text-[11px] text-[var(--faint)] mb-3">waybills linked to a collaboration via tracking number</p>
              <Bars
                data={[
                  { label: "Matched", n: l.matched },
                  { label: "Unmatched", n: l.total - l.matched },
                ]}
                total={l.total}
                color="var(--phase-content)"
              />
              <p className="text-[11px] text-[var(--faint)] mt-3">
                {l.matched} of {l.total} waybills matched ({matchRate}%). Unmatched = waybill numbers not present on any collaboration
                (different tracking-id formats); these are kept and can be linked as keys align.
              </p>
            </section>
          </div>
        </>
      )}
    </div>
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

function Bars({ data, total, color }: { data: { label: string; n: number }[]; total: number; color: string }) {
  return (
    <div className="space-y-1.5">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2 text-xs">
          <span className="w-20 shrink-0 truncate font-medium" title={d.label}>{d.label}</span>
          <div className="flex-1 h-4 rounded bg-[var(--panel-2)] overflow-hidden">
            <div className="h-full rounded" style={{ width: `${total ? (d.n / total) * 100 : 0}%`, background: color, minWidth: d.n ? 2 : 0 }} />
          </div>
          <span className="w-12 text-right tabular-nums text-[var(--muted)]">{d.n.toLocaleString()}</span>
        </div>
      ))}
      {!data.length && <p className="text-xs text-[var(--faint)]">No data</p>}
    </div>
  );
}
