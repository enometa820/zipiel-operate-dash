"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Columns3, RotateCcw } from "lucide-react";
import {
  DEFAULT_PREFS,
  GRID_COLUMNS,
  LOCKED_COLUMN,
  type Density,
  type GridPrefs,
  type GroupBy,
} from "@/lib/grid-prefs";

const GROUP_OPTS: { value: GroupBy; label: string }[] = [
  { value: "phase", label: "Phase" },
  { value: "status", label: "Status" },
  { value: "none", label: "None" },
];
const DENSITY_OPTS: Density[] = ["condensed", "regular", "relaxed"];

export function GridToolbar({ prefs, onChange, count, total }: { prefs: GridPrefs; onChange: (p: GridPrefs) => void; count: number; total: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented label="Group" options={GROUP_OPTS.map((o) => o.value)} labels={GROUP_OPTS.map((o) => o.label)} value={prefs.groupBy} onSelect={(v) => onChange({ ...prefs, groupBy: v as GroupBy, collapsedGroups: [] })} />
      <Segmented label="Density" options={DENSITY_OPTS} labels={DENSITY_OPTS} value={prefs.density} onSelect={(v) => onChange({ ...prefs, density: v as Density })} capitalize />
      <ColumnManager prefs={prefs} onChange={onChange} />
      <span className="ml-auto text-xs tabular-nums text-[var(--muted)]">
        {count.toLocaleString()} of {total.toLocaleString()}
      </span>
    </div>
  );
}

function Segmented({ label, options, labels, value, onSelect, capitalize }: { label: string; options: string[]; labels: string[]; value: string; onSelect: (v: string) => void; capitalize?: boolean }) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="text-[11px] uppercase tracking-wide text-[var(--faint)]">{label}</span>
      <div className="inline-flex overflow-hidden rounded-lg border border-[var(--border-strong)]">
        {options.map((o, i) => (
          <button
            key={o}
            onClick={() => onSelect(o)}
            className={`px-2.5 py-1.5 text-xs ${capitalize ? "capitalize" : ""} ${value === o ? "bg-[var(--accent)] text-white" : "bg-[var(--panel)] text-[var(--muted)] hover:bg-[var(--panel-2)]"}`}
          >
            {labels[i]}
          </button>
        ))}
      </div>
    </div>
  );
}

function ColumnManager({ prefs, onChange }: { prefs: GridPrefs; onChange: (p: GridPrefs) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // 표시 순서대로 정렬된 컬럼 목록
  const ordered = prefs.columnOrder.map((id) => GRID_COLUMNS.find((c) => c.id === id)).filter(Boolean) as typeof GRID_COLUMNS;

  const setVisible = (id: string, vis: boolean) => onChange({ ...prefs, columnVisibility: { ...prefs.columnVisibility, [id]: vis } });
  const move = (id: string, dir: -1 | 1) => {
    const order = [...prefs.columnOrder];
    const i = order.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 1 || j >= order.length) return; // creator(인덱스0)는 고정
    [order[i], order[j]] = [order[j], order[i]];
    onChange({ ...prefs, columnOrder: order });
  };
  const reset = () => onChange({ ...prefs, columnVisibility: DEFAULT_PREFS.columnVisibility, columnOrder: DEFAULT_PREFS.columnOrder });

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Column manager" className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] px-2.5 py-1.5 text-xs text-[var(--muted)] hover:bg-[var(--panel-2)]">
        <Columns3 size={13} /> Columns
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-1 w-60 rounded-lg border border-[var(--border-strong)] bg-[var(--panel)] p-1.5 shadow-lg">
          <div className="flex items-center justify-between px-1.5 pb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">Columns</span>
            <button onClick={reset} className="inline-flex items-center gap-1 text-[11px] text-[var(--accent)] hover:underline">
              <RotateCcw size={11} /> Reset
            </button>
          </div>
          {ordered.map((col) => {
            const locked = col.id === LOCKED_COLUMN;
            return (
              <div key={col.id} className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-[var(--panel-2)]">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={prefs.columnVisibility[col.id] !== false}
                    disabled={locked}
                    onChange={(e) => setVisible(col.id, e.target.checked)}
                    className="accent-[var(--accent)]"
                  />
                  <span className={`truncate ${locked ? "text-[var(--faint)]" : ""}`}>{col.label}{locked ? " · fixed" : ""}</span>
                </label>
                {!locked && (
                  <span className="flex shrink-0">
                    <button onClick={() => move(col.id, -1)} className="rounded p-0.5 text-[var(--faint)] hover:text-[var(--accent)]" title="Move up" aria-label={`Move ${col.label} up`}><ChevronUp size={12} /></button>
                    <button onClick={() => move(col.id, 1)} className="rounded p-0.5 text-[var(--faint)] hover:text-[var(--accent)]" title="Move down" aria-label={`Move ${col.label} down`}><ChevronDown size={12} /></button>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
