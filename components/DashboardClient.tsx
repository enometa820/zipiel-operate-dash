"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CollaborationView } from "@/lib/data";
import { updateCollaboration, type CollaborationPatch } from "@/app/actions";
import {
  COLUMN_DEFAULT_STATUS,
  PHASES,
  PHASE_META,
  PHASE_STATUSES,
  STATUS_PHASE,
  type BoardColumn,
  type Country,
  type Status,
} from "@/lib/types";
import { applyFilters, EMPTY_FILTERS, type GridFilters } from "@/lib/grid-filters";
import { KanbanBoard } from "./KanbanBoard";
import { WorkGrid } from "./WorkGrid";
import { FilterBar } from "./FilterBar";

type ViewMode = "grid" | "pipeline";

function applyPatch(patch: CollaborationPatch): Partial<CollaborationView> {
  const out: Partial<CollaborationView> = {};
  if (patch.status !== undefined) out.status = patch.status;
  if (patch.manager !== undefined) out.manager = patch.manager;
  if (patch.notes !== undefined) out.notes = patch.notes ?? undefined;
  if (patch.contentFeeKrw !== undefined) out.contentFeeKrw = patch.contentFeeKrw ?? undefined;
  if (patch.lastContact !== undefined) out.lastContact = patch.lastContact ?? undefined;
  return out;
}

export function DashboardClient({ initial, loadedAll = true }: { initial: CollaborationView[]; loadedAll?: boolean }) {
  const router = useRouter();
  const [views, setViews] = useState(initial);
  const [, startTransition] = useTransition();
  const [mode, setMode] = useState<ViewMode>("grid");
  // 기본은 sourcing 숨김(active만 로드됨). loadedAll이면 발굴 풀까지 로드된 상태.
  const [filters, setFilters] = useState<GridFilters>({ ...EMPTY_FILTERS, hideSourcing: !loadedAll });

  // 발굴 풀을 보려면(hideSourcing 해제) 전체 로드로 이동 — 기본 로드엔 sourcing이 없음.
  const onFilterChange = useCallback(
    (next: GridFilters) => {
      if (!loadedAll && next.hideSourcing === false) {
        router.push("/board?all=1");
        return;
      }
      setFilters(next);
    },
    [loadedAll, router]
  );

  const managers = useMemo(() => Array.from(new Set(initial.map((v) => v.manager))).sort(), [initial]);
  const countries = useMemo(
    () => (Array.from(new Set(initial.map((v) => v.creator.country))).sort() as Country[]),
    [initial]
  );

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
      }
    });
  }, []);

  function onMove(coId: string, col: BoardColumn) {
    const target = views.find((v) => v.id === coId);
    if (!target || STATUS_PHASE[target.status] === col) return;
    const next: Status = col === "Dropped" || col === "Seeding" ? COLUMN_DEFAULT_STATUS[col] : PHASE_STATUSES[col][0];
    onEdit(coId, { status: next });
  }

  const filtered = useMemo(() => applyFilters(views, filters), [views, filters]);
  const phaseCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const v of filtered) {
      const p = STATUS_PHASE[v.status];
      m[p] = (m[p] ?? 0) + 1;
    }
    return m;
  }, [filtered]);

  return (
    <div className="space-y-3">
      <FilterBar
        filters={filters}
        onChange={onFilterChange}
        managers={managers}
        countries={countries}
        count={filtered.length}
        total={views.length}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-[var(--border-strong)] overflow-hidden shrink-0">
          {(["grid", "pipeline"] as ViewMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 text-sm capitalize ${mode === m ? "bg-[var(--accent)] text-white" : "bg-[var(--panel)] text-[var(--muted)] hover:bg-[var(--panel-2)]"}`}
            >
              {m === "grid" ? "Grid" : "Pipeline"}
            </button>
          ))}
        </div>

        {/* phase strip — 필터된 집합의 단계 분포(정직 카운트) */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {PHASES.map((p) => (
            <div key={p} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: PHASE_META[p].accent }} />
              <span className="text-[var(--muted)]">{p}</span>
              <span className="font-semibold tabular-nums">{phaseCounts[p] ?? 0}</span>
            </div>
          ))}
        </div>
      </div>

      {mode === "grid" ? (
        <WorkGrid views={filtered} onEdit={onEdit} managers={managers} />
      ) : (
        <KanbanBoard views={filtered} onMove={onMove} onStatusChange={(id, s) => onEdit(id, { status: s })} />
      )}
    </div>
  );
}
