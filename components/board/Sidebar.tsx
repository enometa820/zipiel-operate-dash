"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  ChevronRight,
  CircleDollarSign,
  Clapperboard,
  Globe,
  Handshake,
  Inbox,
  PanelLeftClose,
  Search,
  SlidersHorizontal,
  Truck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import type { CollaborationView } from "@/lib/data";
import {
  COUNTRY_FLAG,
  PHASES,
  PHASE_META,
  PHASE_STATUSES,
  type Country,
  type Status,
} from "@/lib/types";
import { activeFilterCount, EMPTY_FILTERS, type GridFilters } from "@/lib/grid-filters";

// 저장된 뷰 — 시트 17탭 멘탈모델을 상태 프리셋으로. statuses=null → 전체.
type View = { id: string; label: string; icon: LucideIcon; statuses: Status[] | null };
const VIEWS: View[] = [
  { id: "all", label: "All active", icon: Inbox, statuses: null },
  { id: "nego", label: "In negotiation", icon: Handshake, statuses: PHASE_STATUSES.Negotiation },
  { id: "ship", label: "Awaiting shipping", icon: Truck, statuses: ["Request Shipping Information", "Shipping"] },
  { id: "content", label: "Content due", icon: Clapperboard, statuses: PHASE_STATUSES.Content },
  { id: "pay", label: "Payment pending", icon: CircleDollarSign, statuses: ["On Hold"] },
  { id: "done", label: "Completed", icon: Activity, statuses: ["Completed"] },
];

function sameSet(a: Status[], b: Status[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

export function Sidebar({
  filters,
  onChange,
  managers,
  countries,
  views,
  collapsed,
  onToggleCollapsed,
}: {
  filters: GridFilters;
  onChange: (f: GridFilters) => void;
  managers: string[];
  countries: Country[];
  views: CollaborationView[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const set = (patch: Partial<GridFilters>) => onChange({ ...filters, ...patch });
  const [more, setMore] = useState(false);

  // 카운트(현재 로드 기준) — 뷰·매니저·국가·상태별
  const counts = useMemo(() => {
    const byStatus = new Map<Status, number>();
    const byManager = new Map<string, number>();
    const byCountry = new Map<string, number>();
    for (const v of views) {
      byStatus.set(v.status, (byStatus.get(v.status) ?? 0) + 1);
      byManager.set(v.manager, (byManager.get(v.manager) ?? 0) + 1);
      byCountry.set(v.creator.country, (byCountry.get(v.creator.country) ?? 0) + 1);
    }
    return { byStatus, byManager, byCountry };
  }, [views]);

  const viewCount = (v: View) => (v.statuses === null ? views.length : v.statuses.reduce((n, s) => n + (counts.byStatus.get(s) ?? 0), 0));
  const viewActive = (v: View) => (v.statuses === null ? filters.statuses.length === 0 : sameSet(filters.statuses, v.statuses));
  const applyView = (v: View) => set({ statuses: v.statuses ? [...v.statuses] : [] });

  const activeCount = activeFilterCount(filters);

  return (
    <aside
      data-collapsed={collapsed}
      className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-[var(--border)] bg-[var(--panel)] transition-[width] duration-200 ${
        collapsed ? "w-14" : "w-60"
      }`}
    >
      {/* header */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--border)] px-3">
        {!collapsed && (
          <span className="flex items-center gap-1.5 truncate text-sm font-bold">
            <span className="text-[var(--accent)]">zipiel</span>
            <span className="font-normal text-[var(--faint)]">·</span>
            <span>Board</span>
          </span>
        )}
        <button
          onClick={onToggleCollapsed}
          title={collapsed ? "Expand" : "Collapse"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className="ml-auto rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
        >
          <PanelLeftClose size={16} className={collapsed ? "rotate-180" : ""} />
        </button>
      </div>

      <div className="thin-scroll flex-1 overflow-y-auto py-2">
        {/* VIEWS */}
        <SectionLabel collapsed={collapsed}>Views</SectionLabel>
        {VIEWS.map((v) => (
          <NavItem
            key={v.id}
            icon={v.icon}
            label={v.label}
            count={viewCount(v)}
            active={viewActive(v)}
            collapsed={collapsed}
            onClick={() => applyView(v)}
          />
        ))}

        {/* MANAGERS */}
        <CollapsibleGroup title="Managers" icon={Users} collapsed={collapsed} onExpandSidebar={onToggleCollapsed} count={managers.length}>
          {managers.map((m) => (
            <GroupItem
              key={m}
              label={`@${m}`}
              count={counts.byManager.get(m) ?? 0}
              selected={filters.managers.includes(m)}
              onClick={() => set({ managers: toggle(filters.managers, m) })}
            />
          ))}
        </CollapsibleGroup>

        {/* COUNTRIES */}
        <CollapsibleGroup title="Countries" icon={Globe} collapsed={collapsed} onExpandSidebar={onToggleCollapsed} count={countries.length}>
          {countries.map((cy) => (
            <GroupItem
              key={cy}
              label={`${COUNTRY_FLAG[cy] ?? ""} ${cy}`}
              count={counts.byCountry.get(cy) ?? 0}
              selected={filters.countries.includes(cy)}
              onClick={() => set({ countries: toggle(filters.countries, cy) })}
            />
          ))}
        </CollapsibleGroup>

        {/* FILTERS — collapsed 시 숨김(확장 유도) */}
        {!collapsed && (
          <>
            <SectionLabel collapsed={false}>Filters</SectionLabel>
            <div className="px-3 pb-1">
              <div className="flex items-center gap-1.5 rounded-md border border-[var(--border-strong)] bg-[var(--panel)] px-2">
                <Search size={13} className="shrink-0 text-[var(--faint)]" />
                <input
                  value={filters.q}
                  onChange={(e) => set({ q: e.target.value })}
                  placeholder="Search handle / name…"
                  aria-label="Search collaborations by handle or name"
                  className="w-full bg-transparent py-1.5 text-sm outline-none"
                />
              </div>
            </div>

            <FilterBlock title="Status">
              {PHASES.map((p) => (
                <div key={p} className="mb-1.5">
                  <button
                    onClick={() => toggleGroup(filters, set, PHASE_STATUSES[p])}
                    className="flex w-full items-center gap-1.5 px-1 py-0.5 text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--accent)]"
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: PHASE_META[p].accent }} />
                    {p}
                  </button>
                  {PHASE_STATUSES[p].map((s) => (
                    <label key={s} className="flex cursor-pointer items-center gap-2 rounded py-0.5 pl-4 pr-1 text-xs hover:bg-[var(--panel-2)]">
                      <input type="checkbox" checked={filters.statuses.includes(s)} onChange={() => set({ statuses: toggle(filters.statuses, s) })} className="accent-[var(--accent)]" />
                      <span className="truncate">{s}</span>
                      <span className="ml-auto text-[10px] tabular-nums text-[var(--faint)]">{counts.byStatus.get(s) ?? 0}</span>
                    </label>
                  ))}
                </div>
              ))}
            </FilterBlock>

            <button
              onClick={() => setMore((m) => !m)}
              className="mx-2 mt-1 flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--accent)]"
            >
              <SlidersHorizontal size={13} /> More filters
              {moreCount(filters) ? ` · ${moreCount(filters)}` : ""}
            </button>
            {more && (
              <div className="space-y-2.5 px-3 pb-2 pt-1">
                <Field label="Campaign type">
                  <select
                    value={filters.type}
                    onChange={(e) => set({ type: e.target.value })}
                    className="w-full rounded-md border border-[var(--border-strong)] bg-[var(--panel)] px-2 py-1.5 text-sm outline-none focus:border-[var(--accent)]"
                  >
                    {["all", "Gifted", "Paid", "Affiliate"].map((o) => (
                      <option key={o} value={o}>{o === "all" ? "All types" : o}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Date range">
                  <select
                    value={filters.dateDim}
                    onChange={(e) => set({ dateDim: e.target.value as GridFilters["dateDim"] })}
                    className="mb-1.5 w-full rounded-md border border-[var(--border-strong)] bg-[var(--panel)] px-2 py-1.5 text-sm outline-none focus:border-[var(--accent)]"
                  >
                    <option value="listed">Listed date</option>
                    <option value="lastContact">Last contact</option>
                    <option value="scheduled">Scheduled post</option>
                  </select>
                  <div className="flex items-center gap-1.5 text-xs">
                    <input type="date" value={filters.dateFrom} onChange={(e) => set({ dateFrom: e.target.value })} className="flex-1 rounded border border-[var(--border-strong)] bg-[var(--panel)] px-1.5 py-1" />
                    <span className="text-[var(--muted)]">–</span>
                    <input type="date" value={filters.dateTo} onChange={(e) => set({ dateTo: e.target.value })} className="flex-1 rounded border border-[var(--border-strong)] bg-[var(--panel)] px-1.5 py-1" />
                  </div>
                </Field>
              </div>
            )}
          </>
        )}
      </div>

      {/* applied chips */}
      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--panel)] p-2">
        {collapsed ? (
          activeCount > 0 && (
            <div className="mx-auto grid h-5 w-5 place-items-center rounded-full bg-[var(--accent)] text-[10px] font-bold text-white">{activeCount}</div>
          )
        ) : (
          <Chips filters={filters} onChange={onChange} />
        )}
      </div>
    </aside>
  );
}

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

function toggleGroup(filters: GridFilters, set: (p: Partial<GridFilters>) => void, statuses: Status[]) {
  const all = statuses.every((s) => filters.statuses.includes(s));
  set({ statuses: all ? filters.statuses.filter((s) => !statuses.includes(s)) : Array.from(new Set([...filters.statuses, ...statuses])) });
}

function moreCount(f: GridFilters): number {
  return (f.type !== "all" ? 1 : 0) + (f.dateFrom || f.dateTo ? 1 : 0);
}

function SectionLabel({ children, collapsed }: { children: React.ReactNode; collapsed: boolean }) {
  if (collapsed) return <div className="mx-3 my-2 h-px bg-[var(--border)]" />;
  return <div className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">{children}</div>;
}

function NavItem({ icon: Icon, label, count, active, collapsed, onClick }: { icon: LucideIcon; label: string; count?: number; active?: boolean; collapsed: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      aria-label={label}
      className={`flex w-full items-center gap-2.5 rounded-lg text-sm ${collapsed ? "mx-auto w-10 justify-center py-2" : "mx-2 px-2.5 py-1.5"} ${
        active ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent)]" : "text-[var(--muted)] hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
      }`}
      style={{ width: collapsed ? undefined : "calc(100% - 1rem)" }}
    >
      <Icon size={16} className="shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
      {!collapsed && count != null && <span className="ml-auto text-[11px] tabular-nums text-[var(--faint)]">{count.toLocaleString()}</span>}
    </button>
  );
}

function CollapsibleGroup({ title, icon: Icon, collapsed, onExpandSidebar, count, children }: { title: string; icon: LucideIcon; collapsed: boolean; onExpandSidebar: () => void; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  if (collapsed)
    return (
      <NavItem
        icon={Icon}
        label={title}
        collapsed
        onClick={() => {
          setOpen(true);
          onExpandSidebar();
        }}
      />
    );
  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)] hover:text-[var(--muted)]"
      >
        <ChevronRight size={12} className={`transition-transform ${open ? "rotate-90" : ""}`} />
        {title}
        <span className="ml-auto font-normal normal-case tracking-normal text-[var(--faint)]">{count}</span>
      </button>
      {open && <div className="space-y-0.5">{children}</div>}
    </div>
  );
}

function GroupItem({ label, count, selected, onClick }: { label: string; count: number; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`mx-2 flex items-center gap-2 rounded-md px-2.5 py-1 text-sm ${selected ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--muted)] hover:bg-[var(--panel-2)]"}`}
      style={{ width: "calc(100% - 1rem)" }}
    >
      <span className="truncate">{label}</span>
      <span className="ml-auto text-[11px] tabular-nums text-[var(--faint)]">{count.toLocaleString()}</span>
    </button>
  );
}

function FilterBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-2 py-1">
      <div className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">{title}</div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Chips({ filters, onChange }: { filters: GridFilters; onChange: (f: GridFilters) => void }) {
  const chips: { key: string; label: string; clear: () => void }[] = [];
  for (const s of filters.statuses) chips.push({ key: `s-${s}`, label: s, clear: () => onChange({ ...filters, statuses: filters.statuses.filter((x) => x !== s) }) });
  for (const m of filters.managers) chips.push({ key: `m-${m}`, label: `@${m}`, clear: () => onChange({ ...filters, managers: filters.managers.filter((x) => x !== m) }) });
  for (const cy of filters.countries) chips.push({ key: `c-${cy}`, label: cy, clear: () => onChange({ ...filters, countries: filters.countries.filter((x) => x !== cy) }) });
  if (filters.type !== "all") chips.push({ key: "type", label: filters.type, clear: () => onChange({ ...filters, type: "all" }) });
  if (filters.q) chips.push({ key: "q", label: `"${filters.q}"`, clear: () => onChange({ ...filters, q: "" }) });
  if (filters.dateFrom || filters.dateTo) chips.push({ key: "date", label: "date", clear: () => onChange({ ...filters, dateFrom: "", dateTo: "" }) });

  if (chips.length === 0) return <p className="px-1 text-[11px] text-[var(--faint)]">No filters applied</p>;

  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((c) => (
        <span key={c.key} className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] py-0.5 pl-2 pr-1 text-[11px] font-medium text-[var(--accent)]">
          <span className="max-w-[120px] truncate">{c.label}</span>
          <button onClick={c.clear} className="rounded-full p-0.5 hover:bg-white/40">
            <X size={11} />
          </button>
        </span>
      ))}
      <button onClick={() => onChange({ ...EMPTY_FILTERS, hideSourcing: filters.hideSourcing })} className="px-1.5 py-0.5 text-[11px] text-[var(--muted)] hover:text-[var(--accent)]">
        Clear all
      </button>
    </div>
  );
}
