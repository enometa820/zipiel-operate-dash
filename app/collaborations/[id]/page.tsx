import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchCollaborationView, fetchPayment, fetchStatusEvents } from "@/lib/queries";
import { formatCompact, formatKrw, formatDate, daysAgo } from "@/lib/utils";
import { CampaignBadge, CountryFlag, ManagerBadge, PlatformBadge, TierBadge } from "@/components/badges";
import { StatusEditor } from "@/components/StatusEditor";
import { PaymentEditor } from "@/components/PaymentEditor";
import { STATUS_KO } from "@/lib/types";

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const co = await fetchCollaborationView(id);
  if (!co) notFound();

  const [events, payment] = await Promise.all([fetchStatusEvents(id), fetchPayment(id)]);

  // CPV = content fee ÷ avg views of last 6 posts (effie's definition)
  const cpvDisplay = co.cpv
    ? `₩${co.cpv}`
    : co.contentFeeKrw && co.creator.avgViews
      ? `₩${(co.contentFeeKrw / co.creator.avgViews).toFixed(1)} (calc)`
      : "—";

  return (
    <div className="max-w-[900px] mx-auto px-5 py-6">
      <Link href="/" className="text-sm text-[var(--accent)] hover:underline">← Back to pipeline</Link>

      {/* Header */}
      <div className="card p-5 mt-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CountryFlag country={co.creator.country} />
              <h1 className="text-2xl font-bold">@{co.creator.handle}</h1>
            </div>
            <p className="text-sm text-[var(--muted)] mt-1">
              {co.creator.name} · {formatCompact(co.creator.followers)} followers
              {co.creator.avgViews ? ` · ${formatCompact(co.creator.avgViews)} avg views` : ""}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              <PlatformBadge platform={co.creator.platform} />
              <TierBadge tier={co.creator.tier} />
              <CampaignBadge type={co.campaign.type} />
              <ManagerBadge manager={co.manager} />
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusEditor id={co.id} status={co.status} />
            <p className="text-xs text-[var(--muted)]">
              {STATUS_KO[co.status]} · last contact {daysAgo(co.lastContact)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mt-4">
        {/* Deal terms */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold mb-3">Deal</h2>
          <Row label="Campaign" value={co.campaign.name} />
          <Row label="Type" value={co.campaign.type} />
          <Row label="Content fee" value={formatKrw(co.contentFeeKrw)} />
          <Row label="Avg views (6 posts)" value={co.creator.avgViews ? formatCompact(co.creator.avgViews) : "—"} />
          <Row label="CPV (₩/view)" value={cpvDisplay} />
          <Row label="Tracking #" value={co.trackingNumber ?? "—"} />
          <Row label="Post" value={co.postUrl ? <a className="text-[var(--accent)] hover:underline" href={co.postUrl} target="_blank" rel="noreferrer">View ↗</a> : "—"} />
          <div className="mt-2 pt-2 border-t border-[var(--border)]">
            <Row label="Listed date" value={formatDate(co.listedDate)} />
            <Row label="Last contact" value={formatDate(co.lastContact)} />
            <Row label="Scheduled upload" value={formatDate(co.scheduledPostDate)} />
          </div>
          <p className="text-[11px] text-[var(--faint)] mt-2">CPV = content fee ÷ avg views of last 6 posts</p>
          {co.notes && <p className="text-sm text-[var(--muted)] mt-3 pt-3 border-t border-[var(--border)]">{co.notes}</p>}
        </div>

        {/* Payment + tax — 실제 지급 기록(Executed fee 실값화) */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold mb-3">Payment</h2>
          <PaymentEditor collaborationId={co.id} payment={payment} suggestedGross={co.contentFeeKrw} />
        </div>
      </div>

      {/* Status timeline */}
      <div className="card p-5 mt-4">
        <h2 className="text-sm font-semibold mb-3">Status history</h2>
        {events.length ? (
          <ol className="space-y-3">
            {events.map((e) => (
              <li key={e.id} className="flex items-start gap-3 text-sm">
                <span className="h-2 w-2 rounded-full bg-[var(--accent)] mt-1.5 shrink-0" />
                <div>
                  <span className="font-medium">{e.from ?? "—"} → {e.to}</span>
                  <span className="text-[var(--muted)] text-xs ml-2">
                    by @{e.changedBy} · {new Date(e.changedAt).toISOString().slice(0, 10)}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-[var(--muted)]">No transitions recorded yet.</p>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
