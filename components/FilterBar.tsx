"use client";

import { useEffect, useRef, useState } from "react";
import {
  COUNTRY_FLAG,
  PHASES,
  PHASE_STATUSES,
  STATUS_KO,
  type Country,
  type Status,
} from "@/lib/types";
import { activeFilterCount, type DateDim, type GridFilters } from "@/lib/grid-filters";

// 작업 그리드 필터바. 전체가 클라이언트에 로드돼 있어 즉시 반영.
const OFF_PIPELINE: Status[] = ["Simple Seeding/PR", "Drop"];

export function FilterBar({
  filters,
  onChange,
  managers,
  countries,
  count,
  total,
}: {
  filters: GridFilters;
  onChange: (f: GridFilters) => void;
  managers: string[];
  countries: Country[];
  count: number;
  total: number;
}) {
  const set = (patch: Partial<GridFilters>) => onChange({ ...filters, ...patch });

  return (
    <div className="card p-2.5 flex flex-wrap items-center gap-2">
      <input
        value={filters.q}
        onChange={(e) => set({ q: e.target.value })}
        placeholder="Search handle / name…"
        className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border-strong)] bg-[var(--panel)] outline-none focus:border-[var(--accent)] w-48"
      />

      <StatusFilter selected={filters.statuses} onChange={(statuses) => set({ statuses })} />

      <Popover label="Country" badge={filters.countries.length}>
        <CheckList
          options={countries.map((c) => ({ value: c, label: `${COUNTRY_FLAG[c] ?? ""} ${c}` }))}
          selected={filters.countries}
          onToggle={(v) => set({ countries: toggle(filters.countries, v as Country) })}
        />
      </Popover>

      <Popover label="Manager" badge={filters.managers.length}>
        <CheckList
          options={managers.map((m) => ({ value: m, label: m }))}
          selected={filters.managers}
          onToggle={(v) => set({ managers: toggle(filters.managers, v) })}
        />
      </Popover>

      <select
        value={filters.type}
        onChange={(e) => set({ type: e.target.value })}
        className="px-2 py-1.5 text-sm rounded-lg border border-[var(--border-strong)] bg-[var(--panel)] outline-none focus:border-[var(--accent)]"
      >
        {["all", "Gifted", "Paid", "Affiliate"].map((o) => (
          <option key={o} value={o}>{o === "all" ? "All types" : o}</option>
        ))}
      </select>

      <Popover label="Dates" badge={filters.dateFrom || filters.dateTo ? 1 : 0}>
        <div className="p-2 space-y-2 w-56">
          <select
            value={filters.dateDim}
            onChange={(e) => set({ dateDim: e.target.value as DateDim })}
            className="w-full px-2 py-1.5 text-sm rounded border border-[var(--border-strong)] bg-[var(--panel)]"
          >
            <option value="listed">Listed date</option>
            <option value="lastContact">Last contact</option>
            <option value="scheduled">Scheduled post</option>
          </select>
          <div className="flex items-center gap-1.5 text-xs">
            <input type="date" value={filters.dateFrom} onChange={(e) => set({ dateFrom: e.target.value })} className="flex-1 px-1.5 py-1 rounded border border-[var(--border-strong)] bg-[var(--panel)]" />
            <span className="text-[var(--muted)]">–</span>
            <input type="date" value={filters.dateTo} onChange={(e) => set({ dateTo: e.target.value })} className="flex-1 px-1.5 py-1 rounded border border-[var(--border-strong)] bg-[var(--panel)]" />
          </div>
        </div>
      </Popover>

      <label className="inline-flex items-center gap-1.5 text-sm cursor-pointer select-none px-2 py-1.5 rounded-lg border border-[var(--border-strong)]">
        <input type="checkbox" checked={filters.hideSourcing} onChange={(e) => set({ hideSourcing: e.target.checked })} />
        <span className="text-[var(--muted)]">Hide sourcing</span>
      </label>

      {activeFilterCount(filters) > 0 && (
        <button onClick={() => onChange({ ...filters, statuses: [], countries: [], managers: [], type: "all", q: "", dateFrom: "", dateTo: "", hideSourcing: false })} className="text-xs text-[var(--accent)] hover:underline">
          Clear
        </button>
      )}

      <span className="text-xs text-[var(--muted)] ml-auto tabular-nums">
        {count.toLocaleString()} of {total.toLocaleString()}
      </span>
    </div>
  );
}

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

function Popover({ label, badge, children }: { label: string; badge: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`px-2.5 py-1.5 text-sm rounded-lg border ${badge ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border-strong)] text-[var(--muted)]"}`}
      >
        {label}
        {badge ? ` · ${badge}` : ""}
      </button>
      {open && (
        <div className="absolute z-40 mt-1 rounded-lg border border-[var(--border-strong)] bg-[var(--panel)] shadow-lg max-h-80 overflow-auto min-w-[180px]">
          {children}
        </div>
      )}
    </div>
  );
}

function CheckList({ options, selected, onToggle }: { options: { value: string; label: string }[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="p-1">
      {options.map((o) => (
        <label key={o.value} className="flex items-center gap-2 px-2 py-1 text-sm rounded hover:bg-[var(--panel-2)] cursor-pointer">
          <input type="checkbox" checked={selected.includes(o.value)} onChange={() => onToggle(o.value)} />
          <span className="truncate">{o.label}</span>
        </label>
      ))}
    </div>
  );
}

function StatusFilter({ selected, onChange }: { selected: Status[]; onChange: (s: Status[]) => void }) {
  const groups: { label: string; statuses: Status[] }[] = [
    ...PHASES.map((p) => ({ label: p, statuses: PHASE_STATUSES[p] })),
    { label: "Off-pipeline", statuses: OFF_PIPELINE },
  ];
  const toggleOne = (s: Status) => onChange(toggle(selected, s));
  const toggleGroup = (statuses: Status[]) => {
    const all = statuses.every((s) => selected.includes(s));
    onChange(all ? selected.filter((s) => !statuses.includes(s)) : Array.from(new Set([...selected, ...statuses])));
  };
  return (
    <Popover label="Status" badge={selected.length}>
      <div className="p-1 w-60">
        {groups.map((g) => (
          <div key={g.label} className="mb-1">
            <button onClick={() => toggleGroup(g.statuses)} className="w-full text-left px-2 py-1 text-[11px] uppercase tracking-wide font-semibold text-[var(--faint)] hover:text-[var(--accent)]">
              {g.label}
            </button>
            {g.statuses.map((s) => (
              <label key={s} className="flex items-center gap-2 px-2 py-1 text-sm rounded hover:bg-[var(--panel-2)] cursor-pointer">
                <input type="checkbox" checked={selected.includes(s)} onChange={() => toggleOne(s)} />
                <span className="truncate">{s}</span>
                <span className="text-[10px] text-[var(--faint)] ml-auto">{STATUS_KO[s]}</span>
              </label>
            ))}
          </div>
        ))}
      </div>
    </Popover>
  );
}
