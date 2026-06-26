"use client";

import { useMemo, useRef, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type Row,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronRight } from "lucide-react";
import type { CollaborationView } from "@/lib/data";
import { PHASE_META, PHASES, STATUS_PHASE, STATUSES, type Status } from "@/lib/types";
import { STATUS_STYLE, statusLabel } from "@/lib/status-style";
import { DENSITY, type GridPrefs } from "@/lib/grid-prefs";
import { makeColumns, type EditFn, type GridColMeta } from "./grid/columns";

// 그룹 순서: phase = 6페이즈 + Seeding/Dropped 레인, status = 정본 15순서.
const PHASE_ORDER = [...PHASES, "Seeding", "Dropped"] as const;

type FlatRow =
  | { kind: "group"; key: string; label: string; count: number; accent: string; collapsed: boolean }
  | { kind: "row"; row: Row<CollaborationView> };

interface Props {
  views: CollaborationView[];
  onEdit: EditFn;
  managers: string[];
  prefs: GridPrefs;
  onToggleGroup: (key: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function WorkGrid({ views, onEdit, managers, prefs, onToggleGroup, selectedId, onSelect }: Props) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "listed", desc: true }]);
  const columns = useMemo(() => makeColumns(onEdit, managers), [onEdit, managers]);

  const table = useReactTable({
    data: views,
    columns,
    state: { sorting, columnVisibility: prefs.columnVisibility, columnOrder: prefs.columnOrder },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const leafRows = table.getRowModel().rows;
  const collapsed = useMemo(() => new Set(prefs.collapsedGroups), [prefs.collapsedGroups]);

  // 수동 그룹 평탄 리스트 — 정본 순서 보존(bp-tech 권장), 가상화 단순.
  const flat = useMemo<FlatRow[]>(() => {
    if (prefs.groupBy === "none") return leafRows.map((row) => ({ kind: "row", row }));

    const buckets = new Map<string, Row<CollaborationView>[]>();
    for (const row of leafRows) {
      const st = row.original.status;
      const key = prefs.groupBy === "status" ? st : (STATUS_PHASE[st] as string);
      const arr = buckets.get(key);
      if (arr) arr.push(row);
      else buckets.set(key, [row]);
    }

    const order: string[] = prefs.groupBy === "status" ? [...STATUSES] : [...PHASE_ORDER];
    const out: FlatRow[] = [];
    for (const key of order) {
      const bucket = buckets.get(key);
      if (!bucket?.length) continue;
      const isCollapsed = collapsed.has(key);
      out.push({
        kind: "group",
        key,
        label: prefs.groupBy === "status" ? statusLabel(key as Status) : PHASE_META[key as keyof typeof PHASE_META].label,
        count: bucket.length,
        accent: prefs.groupBy === "status" ? STATUS_STYLE[key as Status].fg : PHASE_META[key as keyof typeof PHASE_META].accent,
        collapsed: isCollapsed,
      });
      if (!isCollapsed) for (const row of bucket) out.push({ kind: "row", row });
    }
    return out;
  }, [leafRows, prefs.groupBy, collapsed]);

  const rowH = DENSITY[prefs.density].rowH;
  const scrollRef = useRef<HTMLDivElement>(null);
  const virt = useVirtualizer({
    count: flat.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowH,
    overscan: 14,
  });

  const flexStyle = (m?: GridColMeta) => ({ flex: `${m?.grow ?? 0} ${m?.shrink ?? 1} ${m?.basis ?? 100}px`, minWidth: 0 });
  const headers = table.getHeaderGroups()[0].headers;
  const cellPad = DENSITY[prefs.density].cell;
  const headPad = DENSITY[prefs.density].head;

  return (
    <div ref={scrollRef} className="card h-full overflow-y-auto overflow-x-hidden">
      {/* 컬럼 헤더 (sticky top) */}
      <div className="sticky top-0 z-20 flex border-b border-[var(--border)] bg-[var(--panel-2)]">
        {headers.map((h, i) => {
          const m = h.column.columnDef.meta as GridColMeta;
          const frozen = i === 0; // 첫 컬럼(Creator) — 가로 스크롤 시 안전장치
          const sorted = h.column.getIsSorted();
          return (
            <div
              key={h.id}
              role="button"
              tabIndex={0}
              aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"}
              onClick={h.column.getToggleSortingHandler()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  h.column.toggleSorting();
                }
              }}
              style={{ ...flexStyle(m), justifyContent: m?.align === "right" ? "flex-end" : "flex-start" }}
              className={`flex cursor-pointer select-none items-center whitespace-nowrap font-semibold text-[var(--muted)] outline-none focus-visible:text-[var(--accent)] ${headPad} ${
                frozen ? "sticky left-0 z-[1] bg-[var(--panel-2)]" : ""
              }`}
            >
              {flexRender(h.column.columnDef.header, h.getContext())}
              {{ asc: " ↑", desc: " ↓" }[sorted as string] ?? ""}
            </div>
          );
        })}
      </div>

      {/* 본문 (세로 가상화, 그룹 헤더 + 데이터 행 혼합) */}
      <div style={{ height: virt.getTotalSize(), position: "relative" }}>
        {virt.getVirtualItems().map((vi) => {
          const item = flat[vi.index];
          if (item.kind === "group") {
            return (
              <div
                key={`g-${item.key}`}
                role="button"
                tabIndex={0}
                aria-expanded={!item.collapsed}
                aria-label={`${item.label} group, ${item.count} items`}
                onClick={() => onToggleGroup(item.key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onToggleGroup(item.key);
                  }
                }}
                className="absolute left-0 top-0 flex w-full cursor-pointer select-none items-center gap-2 border-y border-[var(--border)] bg-[var(--panel-2)] px-2 outline-none focus-visible:bg-[var(--accent-soft)]"
                style={{ height: rowH, transform: `translateY(${vi.start}px)` }}
              >
                <ChevronRight
                  size={13}
                  className="shrink-0 transition-transform"
                  style={{ transform: item.collapsed ? "none" : "rotate(90deg)", color: item.accent }}
                />
                <span className="truncate text-xs font-semibold" style={{ color: item.accent }}>
                  {item.label}
                </span>
                <span className="rounded-full bg-[var(--panel)] px-1.5 py-px text-[10px] font-semibold tabular-nums text-[var(--muted)]">
                  {item.count.toLocaleString()}
                </span>
                <span className="ml-auto text-[10px] uppercase tracking-wide text-[var(--faint)]">
                  {item.collapsed ? "Show" : "Hide"}
                </span>
              </div>
            );
          }
          const row = item.row;
          const isSel = row.original.id === selectedId;
          return (
            <div
              key={row.id}
              onClick={() => onSelect(row.original.id)}
              className={`group absolute left-0 top-0 flex w-full cursor-pointer border-b border-[var(--border)] ${
                isSel ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--panel-2)]"
              }`}
              style={{ height: rowH, transform: `translateY(${vi.start}px)` }}
            >
              {row.getVisibleCells().map((cell, i) => {
                const m = cell.column.columnDef.meta as GridColMeta;
                const frozen = i === 0;
                return (
                  <div
                    key={cell.id}
                    style={{ ...flexStyle(m), justifyContent: m?.align === "right" ? "flex-end" : "flex-start" }}
                    className={`flex items-center overflow-hidden whitespace-nowrap ${cellPad} ${
                      frozen ? `sticky left-0 z-[1] ${isSel ? "bg-[var(--accent-soft)]" : "bg-[var(--panel)] group-hover:bg-[var(--panel-2)]"}` : ""
                    }`}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                );
              })}
            </div>
          );
        })}
        {flat.length === 0 && (
          <div className="py-16 text-center text-sm text-[var(--faint)]">No collaborations match the current filters.</div>
        )}
      </div>
    </div>
  );
}
