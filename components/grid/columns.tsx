"use client";

import { createColumnHelper, type ColumnDef, type RowData } from "@tanstack/react-table";
import Link from "next/link";
import type { CollaborationView } from "@/lib/data";
import { PHASE_META, STATUS_KO, STATUS_PHASE, STATUSES, type Status } from "@/lib/types";
import { CampaignBadge, CountryFlag, PlatformBadge, TierBadge } from "@/components/badges";
import { formatCompact, formatDate } from "@/lib/utils";
import type { CollaborationPatch } from "@/app/actions";
import { SelectCell, TextCell } from "./EditableCell";

// 화면 폭에 맞춰 채우는 fit-to-width 컬럼(가로 스크롤 지양). 폭은 flex basis/grow로.
// 부가 컬럼(CPV·Notes·배송·예정일·링크)은 Deal Page로 — 가로로 늘리지 않는다.
declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    basis?: number;
    grow?: number;
    align?: "right";
  }
}

export interface GridColMeta {
  basis?: number;
  grow?: number;
  align?: "right";
}

export type EditFn = (id: string, patch: CollaborationPatch) => void;

/* eslint-disable @typescript-eslint/no-explicit-any */
const c = createColumnHelper<CollaborationView>();
const STATUS_OPTS = STATUSES.map((s) => ({ value: s, label: s, title: STATUS_KO[s] }));

function FeeCell({ row, onEdit }: { row: CollaborationView; onEdit: EditFn }) {
  const unverified = row.feeSource === "unverified";
  return (
    <div className="flex items-center justify-end gap-1 w-full min-w-0">
      {unverified && (
        <span title="Source currency unverified — excluded from totals" className="text-[var(--phase-negotiation)] text-[10px] shrink-0">
          ⚠
        </span>
      )}
      <TextCell
        type="number"
        value={row.contentFeeKrw != null ? String(row.contentFeeKrw) : ""}
        placeholder="—"
        onCommit={(v) => onEdit(row.id, { contentFeeKrw: v === "" ? null : Number(v) })}
      />
    </div>
  );
}

export function makeColumns(onEdit: EditFn, managerOptions: string[]): ColumnDef<CollaborationView, any>[] {
  const managerOpts = managerOptions.map((m) => ({ value: m, label: m }));
  return [
    c.accessor((r) => r.creator.handle, {
      id: "creator",
      header: "Creator",
      meta: { basis: 170, grow: 2 },
      cell: (ctx) => (
        <div className="flex items-center gap-1.5 truncate w-full min-w-0">
          <CountryFlag country={ctx.row.original.creator.country} />
          <Link
            href={`/collaborations/${ctx.row.original.id}`}
            className="font-medium truncate hover:text-[var(--accent)] hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            @{ctx.getValue() as string}
          </Link>
        </div>
      ),
    }),
    c.accessor("status", {
      id: "status",
      header: "Status",
      meta: { basis: 150 },
      cell: (ctx) => {
        const st = ctx.getValue() as Status;
        return (
          <SelectCell
            value={st}
            options={STATUS_OPTS}
            accent={PHASE_META[STATUS_PHASE[st]].accent}
            onCommit={(v) => onEdit(ctx.row.original.id, { status: v as Status })}
          />
        );
      },
    }),
    c.accessor((r) => r.creator.platform, {
      id: "platform",
      header: "Platform",
      meta: { basis: 86, grow: 1 },
      cell: (ctx) => <PlatformBadge platform={ctx.row.original.creator.platform} />,
    }),
    c.accessor((r) => r.creator.tier, {
      id: "tier",
      header: "Tier",
      meta: { basis: 58 },
      cell: (ctx) => <TierBadge tier={ctx.row.original.creator.tier} />,
    }),
    c.accessor((r) => r.creator.followers, {
      id: "followers",
      header: "Followers",
      meta: { basis: 72, align: "right" },
      cell: (ctx) => <span className="tabular-nums">{formatCompact(ctx.getValue() as number)}</span>,
    }),
    c.accessor((r) => r.campaign.type, {
      id: "type",
      header: "Campaign",
      meta: { basis: 86, grow: 1 },
      cell: (ctx) => <CampaignBadge type={ctx.row.original.campaign.type} />,
    }),
    c.accessor("manager", {
      id: "manager",
      header: "Manager",
      meta: { basis: 104, grow: 1 },
      cell: (ctx) => <SelectCell value={ctx.getValue() as string} options={managerOpts} onCommit={(v) => onEdit(ctx.row.original.id, { manager: v })} />,
    }),
    c.accessor((r) => r.lastContact ?? "", {
      id: "last",
      header: "Last contact",
      meta: { basis: 124 },
      cell: (ctx) => <TextCell type="date" value={(ctx.getValue() as string) || ""} onCommit={(v) => onEdit(ctx.row.original.id, { lastContact: v || null })} />,
    }),
    c.accessor((r) => r.contentFeeKrw ?? 0, {
      id: "fee",
      header: "Fee (KRW)",
      meta: { basis: 106, align: "right" },
      cell: (ctx) => <FeeCell row={ctx.row.original} onEdit={onEdit} />,
    }),
    c.accessor((r) => r.listedDate ?? "", {
      id: "listed",
      header: "Listed",
      meta: { basis: 92 },
      cell: (ctx) => <span className="text-[var(--muted)] tabular-nums">{formatDate(ctx.getValue() as string)}</span>,
    }),
  ];
}
