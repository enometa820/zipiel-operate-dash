"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { CollaborationView } from "@/lib/data";
import { formatCompact, formatKrw, daysAgo } from "@/lib/utils";
import { CampaignBadge, CountryFlag, ManagerBadge, PlatformBadge, StatusBadge, TierBadge } from "./badges";

const col = createColumnHelper<CollaborationView>();

export function CollaborationTable({ views }: { views: CollaborationView[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo(
    () => [
      col.accessor((r) => r.creator.handle, {
        id: "creator",
        header: "Creator",
        cell: (c) => (
          <div className="flex items-center gap-1.5">
            <CountryFlag country={c.row.original.creator.country} />
            <Link href={`/collaborations/${c.row.original.id}`} className="font-medium hover:text-[var(--accent)] hover:underline">
              @{c.getValue() as string}
            </Link>
          </div>
        ),
      }),
      col.accessor((r) => r.creator.platform, {
        id: "platform",
        header: "Platform",
        cell: (c) => <PlatformBadge platform={c.row.original.creator.platform} />,
      }),
      col.accessor((r) => r.creator.tier, { id: "tier", header: "Tier", cell: (c) => <TierBadge tier={c.row.original.creator.tier} /> }),
      col.accessor((r) => r.creator.followers, {
        id: "followers",
        header: "Followers",
        cell: (c) => <span className="tabular-nums">{formatCompact(c.getValue() as number)}</span>,
      }),
      col.accessor((r) => r.campaign.type, { id: "type", header: "Campaign", cell: (c) => <CampaignBadge type={c.row.original.campaign.type} /> }),
      col.accessor("status", { header: "Status", cell: (c) => <StatusBadge status={c.getValue()} /> }),
      col.accessor("manager", { header: "Manager", cell: (c) => <ManagerBadge manager={c.getValue()} /> }),
      col.accessor((r) => r.cpv ?? null, {
        id: "cpv",
        header: "CPV",
        cell: (c) => <span className="tabular-nums">{c.getValue() ? `₩${c.getValue()}` : "—"}</span>,
      }),
      col.accessor((r) => r.contentFeeKrw ?? 0, {
        id: "fee",
        header: "Fee",
        cell: (c) => <span className="tabular-nums">{c.getValue() ? formatKrw(c.getValue() as number) : "—"}</span>,
      }),
      col.accessor((r) => r.lastContact ?? "", { id: "last", header: "Last contact", cell: (c) => <span className="text-[var(--muted)]">{daysAgo(c.getValue() as string)}</span> }),
    ],
    []
  );

  const table = useReactTable({
    data: views,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
  });

  const pg = table.getState().pagination;
  const total = table.getFilteredRowModel().rows.length;
  const start = pg.pageIndex * pg.pageSize + 1;
  const end = Math.min(start + pg.pageSize - 1, total);

  return (
    <div className="space-y-2">
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-[var(--border)] bg-[var(--panel-2)]">
                  {hg.headers.map((h) => (
                    <th
                      key={h.id}
                      onClick={h.column.getToggleSortingHandler()}
                      className="text-left font-semibold text-[var(--muted)] text-xs px-3 py-2.5 cursor-pointer whitespace-nowrap select-none"
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {{ asc: " ↑", desc: " ↓" }[h.column.getIsSorted() as string] ?? ""}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--panel-2)]">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2.5 whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--muted)]">
          {total > 0 ? `${start}–${end} of ${total}` : "0"}
        </span>
        <div className="flex items-center gap-1">
          <PageBtn onClick={() => table.firstPage()} disabled={!table.getCanPreviousPage()}>«</PageBtn>
          <PageBtn onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>‹</PageBtn>
          <span className="px-2 text-[var(--muted)] tabular-nums">
            {pg.pageIndex + 1} / {table.getPageCount()}
          </span>
          <PageBtn onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>›</PageBtn>
          <PageBtn onClick={() => table.lastPage()} disabled={!table.getCanNextPage()}>»</PageBtn>
        </div>
      </div>
    </div>
  );
}

function PageBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-2.5 py-1 rounded-md border border-[var(--border-strong)] bg-[var(--panel)] disabled:opacity-40 hover:bg-[var(--panel-2)]"
    >
      {children}
    </button>
  );
}
