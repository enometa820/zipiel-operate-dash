"use client";

import { useMemo, useState, useTransition } from "react";
import type { CollaborationView } from "@/lib/data";
import { updateStatus } from "@/app/actions";
import {
  PHASES,
  PHASE_META,
  PHASE_STATUSES,
  STATUS_PHASE,
  type Phase,
} from "@/lib/types";
import { formatKrw } from "@/lib/utils";
import { KanbanBoard } from "./KanbanBoard";
import { CollaborationTable } from "./CollaborationTable";

type Col = Phase | "Dropped";
type ViewMode = "kanban" | "table";

export function DashboardClient({ initial }: { initial: CollaborationView[] }) {
  const [views, setViews] = useState(initial);
  const [, startTransition] = useTransition();
  const [mode, setMode] = useState<ViewMode>("kanban");
  const [manager, setManager] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [q, setQ] = useState("");

  const managers = useMemo(() => Array.from(new Set(initial.map((v) => v.manager))).sort(), [initial]);

  function onMove(coId: string, col: Col) {
    const target = views.find((v) => v.id === coId);
    if (!target || STATUS_PHASE[target.status] === col) return;
    const next = col === "Dropped" ? "Dropped" : PHASE_STATUSES[col as Phase][0];
    // optimistic UI, then persist to DB (trigger logs status_history)
    setViews((prev) => prev.map((v) => (v.id === coId ? { ...v, status: next } : v)));
    startTransition(async () => {
      const res = await updateStatus(coId, next);
      if (!res.ok) {
        // revert on failure
        setViews((prev) => prev.map((v) => (v.id === coId ? { ...v, status: target.status } : v)));
      }
    });
  }

  const filtered = views.filter((v) => {
    if (manager !== "all" && v.manager !== manager) return false;
    if (type !== "all" && v.campaign.type !== type) return false;
    if (q && !v.creator.handle.toLowerCase().includes(q.toLowerCase()) && !v.creator.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const active = filtered.filter((v) => v.status !== "Dropped");
  const dropped = filtered.filter((v) => v.status === "Dropped").length;
  const totalFee = filtered.filter((v) => v.status !== "Dropped").reduce((s, v) => s + (v.contentFeeKrw ?? 0), 0);

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Active collabs" value={String(active.length)} />
        <Kpi label="In negotiation+" value={String(active.filter((v) => !["Sourcing"].includes(STATUS_PHASE[v.status])).length)} />
        <Kpi label="Committed fee" value={formatKrw(totalFee)} />
        <Kpi label="Dropped" value={String(dropped)} tone="muted" />
      </div>

      {/* Phase strip */}
      <div className="card p-3 flex flex-wrap gap-x-5 gap-y-2">
        {PHASES.map((p) => {
          const n = active.filter((v) => STATUS_PHASE[v.status] === p).length;
          return (
            <div key={p} className="flex items-center gap-2 text-sm">
              <span className="h-2 w-2 rounded-full" style={{ background: PHASE_META[p].accent }} />
              <span className="text-[var(--muted)]">{p}</span>
              <span className="font-semibold tabular-nums">{n}</span>
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-[var(--border-strong)] overflow-hidden">
          {(["kanban", "table"] as ViewMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 text-sm capitalize ${mode === m ? "bg-[var(--accent)] text-white" : "bg-[var(--panel)] text-[var(--muted)]"}`}
            >
              {m}
            </button>
          ))}
        </div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search handle…"
          className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border-strong)] bg-[var(--panel)] outline-none focus:border-[var(--accent)] w-44"
        />

        <Select value={manager} onChange={setManager} label="Manager" options={["all", ...managers]} />
        <Select value={type} onChange={setType} label="Type" options={["all", "Gifted", "Paid", "Affiliate"]} />

        <span className="text-xs text-[var(--muted)] ml-auto">{filtered.length} of {views.length}</span>
      </div>

      {mode === "kanban" ? (
        <KanbanBoard views={filtered} onMove={onMove} />
      ) : (
        <CollaborationTable views={filtered} />
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "muted" }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-[var(--muted)]">{label}</div>
      <div className={`text-2xl font-bold mt-1 tabular-nums ${tone === "muted" ? "text-[var(--faint)]" : ""}`}>{value}</div>
    </div>
  );
}

function Select({ value, onChange, label, options }: { value: string; onChange: (v: string) => void; label: string; options: string[] }) {
  return (
    <label className="inline-flex items-center gap-1.5 text-sm">
      <span className="text-[var(--muted)] text-xs">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-2 py-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--panel)] outline-none focus:border-[var(--accent)] capitalize"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}
