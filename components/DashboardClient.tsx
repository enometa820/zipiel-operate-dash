"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Layers } from "lucide-react";
import type { CollaborationView } from "@/lib/data";
import { updateCollaboration, type CollaborationPatch } from "@/app/actions";
import { type Country } from "@/lib/types";
import { applyFilters, EMPTY_FILTERS, type GridFilters } from "@/lib/grid-filters";
import { mergePrefs, PREFS_KEY, DEFAULT_PREFS, type GridPrefs } from "@/lib/grid-prefs";
import { useLocalStorage } from "@/lib/use-local-storage";
import { NavTabs } from "./NavTabs";
import { Sidebar } from "./board/Sidebar";
import { GridToolbar } from "./board/GridToolbar";
import { WorkGrid } from "./WorkGrid";
import { DetailPanel } from "./DetailPanel";

function applyPatch(patch: CollaborationPatch): Partial<CollaborationView> {
  const out: Partial<CollaborationView> = {};
  if (patch.status !== undefined) out.status = patch.status;
  if (patch.manager !== undefined) out.manager = patch.manager;
  if (patch.notes !== undefined) out.notes = patch.notes ?? undefined;
  if (patch.contentFeeKrw !== undefined) out.contentFeeKrw = patch.contentFeeKrw ?? undefined;
  if (patch.lastContact !== undefined) out.lastContact = patch.lastContact ?? undefined;
  return out;
}

export function DashboardClient({ initial, loadedAll = true, live = false }: { initial: CollaborationView[]; loadedAll?: boolean; live?: boolean }) {
  const router = useRouter();
  const [views, setViews] = useState(initial);
  const [, startTransition] = useTransition();
  const [filters, setFilters] = useState<GridFilters>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editError, setEditError] = useState("");

  const [prefsRaw, setPrefsRaw] = useLocalStorage<GridPrefs>(PREFS_KEY, DEFAULT_PREFS);
  const prefs = useMemo(() => mergePrefs(prefsRaw), [prefsRaw]);
  const [collapsed, setCollapsed] = useLocalStorage<boolean>("board-sidebar-collapsed", false);

  const managers = useMemo(() => Array.from(new Set(initial.map((v) => v.manager))).sort(), [initial]);
  const countries = useMemo(() => Array.from(new Set(initial.map((v) => v.creator.country))).sort() as Country[], [initial]);

  // 인라인 편집 — 낙관 갱신 후 persist, 실패 시 롤백
  const onEdit = useCallback((id: string, patch: CollaborationPatch) => {
    let prev: CollaborationView | undefined;
    setViews((cur) =>
      cur.map((v) => {
        if (v.id !== id) return v;
        prev = v;
        return { ...v, ...applyPatch(patch) };
      })
    );
    startTransition(async () => {
      const res = await updateCollaboration(id, patch);
      if (!res.ok && prev) {
        const p = prev;
        setViews((cur) => cur.map((v) => (v.id === id ? p : v)));
        setEditError(`Edit reverted — ${res.reason ?? "save failed"}`);
      }
    });
  }, []);

  const filtered = useMemo(() => applyFilters(views, filters), [views, filters]);
  const selected = useMemo(() => views.find((v) => v.id === selectedId) ?? null, [views, selectedId]);

  const onToggleGroup = useCallback(
    (key: string) =>
      setPrefsRaw((p) => {
        const cur = mergePrefs(p);
        const set = new Set(cur.collapsedGroups);
        if (set.has(key)) set.delete(key);
        else set.add(key);
        return { ...cur, collapsedGroups: [...set] };
      }),
    [setPrefsRaw]
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        filters={filters}
        onChange={setFilters}
        managers={managers}
        countries={countries}
        views={views}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
      />

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* top bar — cross-page nav */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-[var(--border)] px-5 py-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-lg font-bold">
              <span>Work board</span>
            </h1>
            <p className="mt-0.5 truncate text-xs text-[var(--muted)]">Scan & edit collaborations like a sheet — grouped by stage, no horizontal scroll</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <NavTabs />
            <span className="chip">{live ? "Supabase · live" : "Demo data"}</span>
          </div>
        </div>

        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-2.5">
          <GridToolbar prefs={prefs} onChange={setPrefsRaw} count={filtered.length} total={views.length} />
          <button
            onClick={() => router.push(loadedAll ? "/board" : "/board?all=1")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] px-2.5 py-1.5 text-xs text-[var(--muted)] hover:bg-[var(--panel-2)]"
            title={loadedAll ? "Show active pipeline only (faster)" : "Load discovery pool (Sourcing) too"}
          >
            <Layers size={13} />
            {loadedAll ? "Active only" : "Discovery pool"}
          </button>
        </div>

        {/* grid */}
        <div className="min-h-0 flex-1 px-5 pb-5">
          <WorkGrid views={filtered} onEdit={onEdit} managers={managers} prefs={prefs} onToggleGroup={onToggleGroup} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
      </main>

      {editError && (
        <button
          onClick={() => setEditError("")}
          role="alert"
          aria-live="polite"
          className="fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-lg border border-[var(--phase-dropped)] bg-[var(--panel)] px-4 py-2 text-xs text-[var(--phase-dropped)] shadow-lg"
        >
          {editError} · dismiss
        </button>
      )}

      <DetailPanel co={selected} onClose={() => setSelectedId(null)} onEdit={onEdit} />
    </div>
  );
}
