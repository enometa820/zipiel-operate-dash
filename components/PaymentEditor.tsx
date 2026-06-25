"use client";

import { useState, useTransition } from "react";
import { upsertPayment } from "@/app/actions";
import { formatKrw } from "@/lib/utils";
import type { Payment, TaxType } from "@/lib/types";

// 거주지별 원천징수 분기(외국인 일괄 3.3% 금지). 기본율은 추정 — 세무사 확인.
const TAX_OPTS: { value: TaxType; label: string; rate: number }[] = [
  { value: "nonresident_overseas", label: "Non-resident · performed abroad — 0%", rate: 0 },
  { value: "kr_resident_3.3", label: "KR resident — 3.3%", rate: 3.3 },
  { value: "nonresident_domestic", label: "Non-resident · domestic-sourced — 22%", rate: 22 },
  { value: "none", label: "No tax — 0%", rate: 0 },
];
const TAX_LABEL: Record<TaxType, string> = {
  "kr_resident_3.3": "KR resident · 3.3% withheld",
  nonresident_domestic: "Non-resident · domestic-sourced (22% / treaty)",
  nonresident_overseas: "Non-resident · performed abroad · no withholding",
  none: "No tax",
};

export function PaymentEditor({
  collaborationId,
  payment,
  suggestedGross,
}: {
  collaborationId: string;
  payment?: Payment;
  suggestedGross?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [gross, setGross] = useState<string>(payment ? String(payment.grossKrw) : suggestedGross ? String(suggestedGross) : "");
  const [taxType, setTaxType] = useState<TaxType>(payment?.taxType ?? "nonresident_overseas");
  const [status, setStatus] = useState<"pending" | "paid">(payment?.status ?? "pending");
  const [paidAt, setPaidAt] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");

  const grossN = Number(gross) || 0;
  const rate = TAX_OPTS.find((o) => o.value === taxType)?.rate ?? 0;
  const tax = Math.round((grossN * rate) / 100);
  const net = grossN - tax;

  function save() {
    setErr("");
    start(async () => {
      const res = await upsertPayment(collaborationId, { grossKrw: grossN, taxType, status, paidAt: paidAt || null });
      if (res.ok) setEditing(false);
      else setErr(res.reason ?? "failed");
    });
  }

  // 보기 모드 — 기존 지급
  if (!editing && payment) {
    return (
      <>
        <Row label="Gross" value={formatKrw(payment.grossKrw)} />
        <Row label="Tax" value={formatKrw(payment.taxKrw)} />
        <Row label="Net payout" value={<strong>{formatKrw(payment.netKrw)}</strong>} />
        <Row label="Status" value={<span className={payment.status === "paid" ? "text-[var(--phase-payment)] font-medium" : ""}>{payment.status}</span>} />
        <div className="mt-3 pt-3 border-t border-[var(--border)] text-xs text-[var(--muted)]">
          <span className="font-medium text-[var(--text)]">Tax basis:</span> {TAX_LABEL[payment.taxType]}
        </div>
        <button onClick={() => setEditing(true)} className="mt-3 text-xs text-[var(--accent)] hover:underline">
          Edit payment
        </button>
      </>
    );
  }

  // 보기 모드 — 지급 없음
  if (!editing && !payment) {
    return (
      <>
        <p className="text-sm text-[var(--muted)]">No payout recorded yet (gifted / not yet at payment stage).</p>
        <button onClick={() => setEditing(true)} className="mt-3 text-xs px-2.5 py-1.5 rounded-md border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent-soft)]">
          + Record payment
        </button>
      </>
    );
  }

  // 편집 모드
  return (
    <div className="space-y-2.5 text-sm">
      <Field label="Gross (KRW)">
        <input
          type="number"
          value={gross}
          onChange={(e) => setGross(e.target.value)}
          placeholder="0"
          className="w-full px-2 py-1.5 rounded-md border border-[var(--border-strong)] bg-[var(--panel)] outline-none focus:border-[var(--accent)] tabular-nums text-right"
        />
      </Field>
      <Field label="Tax type">
        <select value={taxType} onChange={(e) => setTaxType(e.target.value as TaxType)} className="w-full px-2 py-1.5 rounded-md border border-[var(--border-strong)] bg-[var(--panel)] outline-none focus:border-[var(--accent)]">
          {TAX_OPTS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </Field>
      <div className="rounded-md bg-[var(--panel-2)] p-2.5 text-xs space-y-1">
        <div className="flex justify-between"><span className="text-[var(--muted)]">Withholding ({rate}%)</span><span className="tabular-nums">{formatKrw(tax)}</span></div>
        <div className="flex justify-between font-semibold"><span>Net payout</span><span className="tabular-nums">{formatKrw(net)}</span></div>
      </div>
      <Field label="Status">
        <select value={status} onChange={(e) => setStatus(e.target.value as "pending" | "paid")} className="w-full px-2 py-1.5 rounded-md border border-[var(--border-strong)] bg-[var(--panel)] outline-none focus:border-[var(--accent)]">
          <option value="pending">pending</option>
          <option value="paid">paid</option>
        </select>
      </Field>
      {status === "paid" && (
        <Field label="Paid date">
          <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className="w-full px-2 py-1.5 rounded-md border border-[var(--border-strong)] bg-[var(--panel)] outline-none focus:border-[var(--accent)]" />
        </Field>
      )}
      {err && <p className="text-xs text-[var(--phase-dropped)]">{err}</p>}
      <div className="flex gap-2 pt-1">
        <button onClick={save} disabled={pending || grossN <= 0} className="text-xs px-3 py-1.5 rounded-md bg-[var(--accent)] text-white disabled:opacity-40">
          {pending ? "Saving…" : "Save"}
        </button>
        <button onClick={() => setEditing(false)} disabled={pending} className="text-xs px-3 py-1.5 rounded-md border border-[var(--border-strong)] text-[var(--muted)]">
          Cancel
        </button>
      </div>
      <p className="text-[11px] text-[var(--faint)]">Withholding rates are defaults — confirm with your tax advisor.</p>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-[var(--muted)]">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
