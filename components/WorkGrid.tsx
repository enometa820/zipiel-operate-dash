"use client";

import { useMemo, useRef, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { CollaborationView } from "@/lib/data";
import { makeColumns, type EditFn, type GridColMeta } from "./grid/columns";

const ROW_H = 40;

// 시트형 작업 그리드 — 화면 폭에 맞춰 채우고(가로 스크롤 지양), 세로만 가상화 스크롤(14k행).
// 컬럼은 flex(basis/grow)로 폭을 분배. 부가 컬럼은 Deal Page로.
export function WorkGrid({ views, onEdit, managers }: { views: CollaborationView[]; onEdit: EditFn; managers: string[] }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "listed", desc: true }]);
  const columns = useMemo(() => makeColumns(onEdit, managers), [onEdit, managers]);
  const table = useReactTable({
    data: views,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const rows = table.getRowModel().rows;

  const scrollRef = useRef<HTMLDivElement>(null);
  const virt = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_H,
    overscan: 12,
  });

  const flexStyle = (m?: GridColMeta) => ({ flex: `${m?.grow ?? 0} 1 ${m?.basis ?? 100}px`, minWidth: 0 });
  const headers = table.getHeaderGroups()[0].headers;

  return (
    <div ref={scrollRef} className="card overflow-y-auto overflow-x-hidden" style={{ maxHeight: "calc(100vh - 240px)" }}>
      {/* 헤더 (sticky top, 단일 행) */}
      <div className="sticky top-0 z-20 flex bg-[var(--panel-2)] border-b border-[var(--border)]">
        {headers.map((h) => {
          const m = h.column.columnDef.meta as GridColMeta;
          return (
            <div
              key={h.id}
              onClick={h.column.getToggleSortingHandler()}
              style={{ ...flexStyle(m), justifyContent: m?.align === "right" ? "flex-end" : "flex-start" }}
              className="flex items-center text-xs font-semibold text-[var(--muted)] px-2 py-2 cursor-pointer select-none whitespace-nowrap"
            >
              {flexRender(h.column.columnDef.header, h.getContext())}
              {{ asc: " ↑", desc: " ↓" }[h.column.getIsSorted() as string] ?? ""}
            </div>
          );
        })}
      </div>

      {/* 본문 (세로 가상화) */}
      <div style={{ height: virt.getTotalSize(), position: "relative" }}>
        {virt.getVirtualItems().map((vi) => {
          const row = rows[vi.index];
          return (
            <div
              key={row.id}
              className="flex absolute left-0 top-0 w-full border-b border-[var(--border)] hover:bg-[var(--panel-2)]"
              style={{ height: ROW_H, transform: `translateY(${vi.start}px)` }}
            >
              {row.getVisibleCells().map((cell) => {
                const m = cell.column.columnDef.meta as GridColMeta;
                return (
                  <div
                    key={cell.id}
                    style={{ ...flexStyle(m), justifyContent: m?.align === "right" ? "flex-end" : "flex-start" }}
                    className="flex items-center px-2 text-xs whitespace-nowrap overflow-hidden"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
