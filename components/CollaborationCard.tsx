"use client";

import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { CollaborationView } from "@/lib/data";
import { formatCompact, formatKrw } from "@/lib/utils";
import { CampaignBadge, CountryFlag, ManagerBadge, PlatformBadge, TierBadge } from "./badges";

export function CollaborationCard({ co, dragging }: { co: CollaborationView; dragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: co.id,
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`card p-3 select-none ${isDragging || dragging ? "opacity-60 shadow-lg" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          {...listeners}
          {...attributes}
          className="cursor-grab active:cursor-grabbing text-left flex-1 min-w-0"
          aria-label="Drag card"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <CountryFlag country={co.creator.country} />
            <span className="font-semibold text-sm truncate">@{co.creator.handle}</span>
          </div>
          <div className="text-[11px] text-[var(--muted)] mt-0.5">
            {formatCompact(co.creator.followers)} followers
          </div>
        </button>
        <Link
          href={`/collaborations/${co.id}`}
          className="text-[11px] text-[var(--accent)] hover:underline shrink-0 mt-0.5"
        >
          Open
        </Link>
      </div>

      <div className="flex flex-wrap gap-1 mt-2">
        <PlatformBadge platform={co.creator.platform} />
        <TierBadge tier={co.creator.tier} />
        <CampaignBadge type={co.campaign.type} />
      </div>

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border)]">
        <ManagerBadge manager={co.manager} />
        <span className="text-[11px] text-[var(--muted)]">
          {co.cpv ? `CPV ₩${co.cpv}` : co.contentFeeKrw ? formatKrw(co.contentFeeKrw) : "Gifted"}
        </span>
      </div>
    </div>
  );
}
