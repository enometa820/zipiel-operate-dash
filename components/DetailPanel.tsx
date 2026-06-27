"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, X } from "lucide-react";
import type { CollaborationView } from "@/lib/data";
import { getPaymentFor, getStatusHistory, type CollaborationPatch } from "@/app/actions";
import { type Payment, type StatusEvent } from "@/lib/types";
import { statusLabel } from "@/lib/status-style";
import { formatCompact, formatDate } from "@/lib/utils";
import { CampaignBadge, CountryFlag, ManagerBadge, PlatformBadge, TierBadge } from "@/components/badges";
import { StatusSelectCell } from "@/components/grid/StatusPill";
import { PaymentEditor } from "@/components/PaymentEditor";

type EditFn = (id: string, patch: CollaborationPatch) => void;

// 행 클릭 시 우측 슬라이드 패널 — 빠른 보기 + 고위험 편집(Fee·Payment). 전체는 Deal Page로.
export function DetailPanel({ co, onClose, onEdit }: { co: CollaborationView | null; onClose: () => void; onEdit: EditFn }) {
  const open = co !== null;
  const asideRef = useRef<HTMLElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  // 접근성: 포커스 이동·트랩·복원 + ESC + body 스크롤 잠금
  useEffect(() => {
    if (!open) return;
    restoreRef.current = (document.activeElement as HTMLElement) ?? null;
    const aside = asideRef.current;
    const focusables = () =>
      aside
        ? Array.from(aside.querySelectorAll<HTMLElement>('button, [href], select, textarea, input, [tabindex]:not([tabindex="-1"])')).filter(
            (el) => !el.hasAttribute("disabled") && el.offsetParent !== null
          )
        : [];
    (focusables()[0] ?? aside)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !aside) return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        aside.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!aside.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  return (
    <>
      {/* 배경 dim — 클릭 시 닫기 */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/15 transition-opacity duration-200 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        aria-hidden
      />
      <aside
        ref={asideRef}
        role="dialog"
        aria-modal="true"
        aria-label="Collaboration detail"
        tabIndex={-1}
        className={`fixed inset-y-0 right-0 z-50 flex w-[440px] max-w-[92vw] flex-col border-l border-[var(--border)] bg-[var(--panel)] shadow-[-8px_0_24px_-12px_rgba(0,0,0,0.18)] outline-none transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {co && <PanelBody key={co.id} co={co} onClose={onClose} onEdit={onEdit} />}
      </aside>
    </>
  );
}

function PanelBody({ co, onClose, onEdit }: { co: CollaborationView; onClose: () => void; onEdit: EditFn }) {
  const [events, setEvents] = useState<StatusEvent[] | null>(null);
  const [payment, setPayment] = useState<Payment | null | undefined>(undefined); // undefined=로딩, null=없음

  useEffect(() => {
    let alive = true;
    getStatusHistory(co.id).then((e) => alive && setEvents(e));
    getPaymentFor(co.id).then((p) => alive && setPayment(p));
    return () => {
      alive = false;
    };
  }, [co.id]);

  return (
    <>
      {/* 헤더 */}
      <div className="shrink-0 border-b border-[var(--border)] px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <CountryFlag country={co.creator.country} />
              <h2 className="truncate text-lg font-bold">@{co.creator.handle}</h2>
            </div>
            <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
              {co.creator.name} · {formatCompact(co.creator.followers)} followers
              {co.creator.avgViews ? ` · ${formatCompact(co.creator.avgViews)} avg views` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              <PlatformBadge platform={co.creator.platform} />
              <TierBadge tier={co.creator.tier} />
              <CampaignBadge type={co.campaign.type} />
              <ManagerBadge manager={co.manager} />
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="-mr-1 rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--panel-2)] hover:text-[var(--text)]">
            <X size={16} />
          </button>
        </div>
        {/* status — 인라인 변경(핵심 동작, 트리거가 history 기록) */}
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wide text-[var(--faint)]">Status</span>
          <div className="min-w-0 flex-1">
            <StatusSelectCell status={co.status} onChange={(s) => onEdit(co.id, { status: s })} />
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div className="thin-scroll flex-1 space-y-5 overflow-y-auto px-5 py-4">
        {/* Deal */}
        <Section title="Deal">
          <Row label="Campaign" value={co.campaign.name} />
          <Row label="Type" value={co.campaign.type} />
          <Row label="Avg views (6 posts)" value={co.creator.avgViews ? formatCompact(co.creator.avgViews) : "—"} />
          <Row label="CPV (₩/view)" value={co.cpv ? `₩${co.cpv}` : co.contentFeeKrw && co.creator.avgViews ? `₩${(co.contentFeeKrw / co.creator.avgViews).toFixed(1)} (calc)` : "—"} />
          <Row label="Tracking #" value={co.trackingNumber ?? "—"} />
          <Row
            label="Post"
            value={co.postUrl ? <a className="text-[var(--accent)] hover:underline" href={co.postUrl} target="_blank" rel="noreferrer">View ↗</a> : "—"}
          />
          <div className="mt-1 border-t border-[var(--border)] pt-1">
            <Row label="Listed" value={formatDate(co.listedDate)} />
            <Row label="Last contact" value={formatDate(co.lastContact)} />
            <Row label="Scheduled upload" value={formatDate(co.scheduledPostDate)} />
          </div>
        </Section>

        {/* Fee — 고위험(자금) 편집 게이트 */}
        <Section title="Content fee — caution">
          <FeeEdit id={co.id} value={co.contentFeeKrw} unverified={co.feeSource === "unverified"} onEdit={onEdit} />
        </Section>

        {/* Notes */}
        <Section title="Notes">
          <NotesEdit id={co.id} value={co.notes ?? ""} onEdit={onEdit} />
        </Section>

        {/* Payment — tax 분기 편집 */}
        <Section title="Payment">
          {payment === undefined ? (
            <p className="text-xs text-[var(--faint)]">Loading…</p>
          ) : (
            <PaymentEditor collaborationId={co.id} payment={payment ?? undefined} suggestedGross={co.contentFeeKrw} />
          )}
        </Section>

        {/* History */}
        <Section title="Status history">
          {events === null ? (
            <p className="text-xs text-[var(--faint)]">Loading…</p>
          ) : events.length ? (
            <ol className="space-y-2.5">
              {events.map((e) => (
                <li key={e.id} className="flex items-start gap-2.5 text-xs">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                  <div className="min-w-0">
                    <span className="font-medium">{e.from ?? "—"} → {e.to}</span>
                    <span className="ml-1.5 text-[var(--faint)]">@{e.changedBy} · {e.changedAt.slice(0, 10)}</span>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-xs text-[var(--muted)]">No transitions recorded yet.</p>
          )}
        </Section>
      </div>

      {/* footer — full page */}
      <div className="flex shrink-0 items-center justify-between border-t border-[var(--border)] px-5 py-3">
        <Link href={`/collaborations/${co.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent)] hover:underline">
          Open full page <ArrowUpRight size={15} />
        </Link>
        <span className="text-[11px] text-[var(--faint)]">{statusLabel(co.status)}</span>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">{title}</h3>
      <div className="card p-3.5">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 text-sm">
      <span className="shrink-0 text-[var(--muted)]">{label}</span>
      <span className="min-w-0 truncate text-right">{value}</span>
    </div>
  );
}

// 고위험 fee 편집 — blur 자동 commit 대신 명시 Save(의도적 마찰).
function FeeEdit({ id, value, unverified, onEdit }: { id: string; value?: number; unverified: boolean; onEdit: EditFn }) {
  const [v, setV] = useState(value != null ? String(value) : "");
  const dirty = (v === "" ? null : Number(v)) !== (value ?? null);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm text-[var(--muted)]">₩</span>
        <input
          type="number"
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder="—"
          className="w-full rounded-md border border-[var(--border-strong)] bg-[var(--panel)] px-2 py-1.5 text-right tabular-nums outline-none focus:border-[var(--accent)]"
        />
        <button
          onClick={() => onEdit(id, { contentFeeKrw: v === "" ? null : Number(v) })}
          disabled={!dirty}
          className="shrink-0 rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs text-white disabled:opacity-40"
        >
          Save
        </button>
      </div>
      {unverified && <p className="text-[11px] text-[var(--phase-negotiation)]">⚠ Source currency unverified — excluded from KPI totals.</p>}
    </div>
  );
}

function NotesEdit({ id, value, onEdit }: { id: string; value: string; onEdit: EditFn }) {
  const [v, setV] = useState(value);
  const dirty = v !== value;
  return (
    <div className="space-y-2">
      <textarea
        value={v}
        onChange={(e) => setV(e.target.value)}
        rows={3}
        placeholder="Communication notes…"
        className="w-full resize-y rounded-md border border-[var(--border-strong)] bg-[var(--panel)] px-2 py-1.5 text-sm outline-none focus:border-[var(--accent)]"
      />
      <button
        onClick={() => onEdit(id, { notes: v || null })}
        disabled={!dirty}
        className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs text-white disabled:opacity-40"
      >
        Save notes
      </button>
    </div>
  );
}
