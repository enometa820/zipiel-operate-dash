"use client";

import { createColumnHelper, type ColumnDef, type RowData } from "@tanstack/react-table";
import Link from "next/link";
import type { CollaborationView } from "@/lib/data";
import { type Status } from "@/lib/types";
import { CampaignBadge, CountryFlag, PlatformBadge, TierBadge } from "@/components/badges";
import { formatCompact, formatDate } from "@/lib/utils";
import type { CollaborationPatch } from "@/app/actions";
import { SelectCell, TextCell } from "./EditableCell";
import { StatusSelectCell } from "./StatusPill";

// 화면 폭에 맞춰 채우는 fit-to-width 컬럼(가로 스크롤 0). 폭은 flex basis/grow로 분배.
// 부가 컬럼은 기본 숨김(컬럼 매니저로 토글) + detail 패널. 데이터 계약(lib/types)은 불변.
declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    basis?: number;
    grow?: number;
    shrink?: number;
    align?: "right";
  }
}

export interface GridColMeta {
  basis?: number;
  grow?: number;
  shrink?: number;
  align?: "right";
}

export type EditFn = (id: string, patch: CollaborationPatch) => void;

/* eslint-disable @typescript-eslint/no-explicit-any */
const c = createColumnHelper<CollaborationView>();

// Fee — 그리드는 표시 전용(고위험 편집은 detail 패널). unverified는 ⚠ 마커.
function FeeCell({ row }: { row: CollaborationView }) {
  const unverified = row.feeSource === "unverified";
  const v = row.contentFeeKrw;
  return (
    <div className="flex w-full min-w-0 items-center justify-end gap-1">
      {unverified && (
        <span title="Source currency unverified — excluded from totals" className="shrink-0 text-[10px] text-[var(--phase-negotiation)]">
          ⚠
        </span>
      )}
      <span className="truncate tabular-nums">{v != null ? "₩" + v.toLocaleString("en-US") : "—"}</span>
    </div>
  );
}

export function makeColumns(onEdit: EditFn, managerOptions: string[]): ColumnDef<CollaborationView, any>[] {
  const managerOpts = managerOptions.map((m) => ({ value: m, label: m }));
  return [
    c.accessor((r) => r.creator.handle, {
      id: "creator",
      header: "Creator",
      meta: { basis: 168, grow: 2 },
      cell: (ctx) => (
        <div className="flex w-full min-w-0 items-center gap-1.5 truncate">
          <CountryFlag country={ctx.row.original.creator.country} />
          <Link
            href={`/collaborations/${ctx.row.original.id}`}
            className="truncate font-medium hover:text-[var(--accent)] hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            @{ctx.getValue() as string}
          </Link>
        </div>
      ),
    }),
    c.accessor("status", {
      id: "status",
      // 가장 중요한 컬럼 — 넓을 땐 우선 확장(grow 2), 좁을 땐 덜 줄어듦(shrink 0.4)으로 한/영 병기 보존
      header: "Status",
      meta: { basis: 188, grow: 2, shrink: 0.4 },
      cell: (ctx) => (
        <StatusSelectCell
          status={ctx.getValue() as Status}
          onChange={(v) => onEdit(ctx.row.original.id, { status: v })}
        />
      ),
    }),
    c.accessor((r) => r.creator.platform, {
      id: "platform",
      header: "Platform",
      meta: { basis: 92, grow: 1 },
      cell: (ctx) => <PlatformBadge platform={ctx.row.original.creator.platform} />,
    }),
    c.accessor((r) => r.creator.followers, {
      id: "followers",
      header: "Followers",
      meta: { basis: 78, align: "right" },
      cell: (ctx) => <span className="tabular-nums">{formatCompact(ctx.getValue() as number)}</span>,
    }),
    c.accessor("manager", {
      id: "manager",
      header: "Manager",
      meta: { basis: 104, grow: 1 },
      cell: (ctx) => (
        <SelectCell value={ctx.getValue() as string} options={managerOpts} ariaLabel="Manager" onCommit={(v) => onEdit(ctx.row.original.id, { manager: v })} />
      ),
    }),
    c.accessor((r) => r.lastContact ?? "", {
      id: "last",
      header: "Last contact",
      meta: { basis: 120 },
      cell: (ctx) => <TextCell type="date" ariaLabel="Last contact date" value={(ctx.getValue() as string) || ""} onCommit={(v) => onEdit(ctx.row.original.id, { lastContact: v || null })} />,
    }),
    c.accessor((r) => r.contentFeeKrw ?? 0, {
      id: "fee",
      header: "Fee (KRW)",
      meta: { basis: 104, align: "right" },
      cell: (ctx) => <FeeCell row={ctx.row.original} />,
    }),
    c.accessor((r) => r.listedDate ?? "", {
      id: "listed",
      header: "Listed",
      meta: { basis: 92 },
      cell: (ctx) => <span className="tabular-nums text-[var(--muted)]">{formatDate(ctx.getValue() as string)}</span>,
    }),
    // ---- 기본 숨김(컬럼 매니저로 토글) ----
    c.accessor((r) => r.creator.tier, {
      id: "tier",
      header: "Tier",
      meta: { basis: 64 },
      cell: (ctx) => <TierBadge tier={ctx.row.original.creator.tier} />,
    }),
    c.accessor((r) => r.campaign.type, {
      id: "type",
      header: "Campaign",
      meta: { basis: 92, grow: 1 },
      cell: (ctx) => <CampaignBadge type={ctx.row.original.campaign.type} />,
    }),
    c.accessor((r) => r.scheduledPostDate ?? "", {
      id: "scheduled",
      header: "Scheduled post",
      meta: { basis: 110 },
      cell: (ctx) => <span className="tabular-nums text-[var(--muted)]">{formatDate(ctx.getValue() as string)}</span>,
    }),
    c.accessor((r) => r.cpv ?? null, {
      id: "cpv",
      header: "CPV",
      meta: { basis: 80, align: "right" },
      cell: (ctx) => {
        const v = ctx.getValue() as number | null;
        return <span className="tabular-nums text-[var(--muted)]">{v != null ? "₩" + v : "—"}</span>;
      },
    }),
  ];
}
