import {
  COUNTRY_FLAG,
  PHASE_META,
  PLATFORM_LABEL,
  STATUS_PHASE,
  TIER_META,
  type CampaignType,
  type Country,
  type Platform,
  type Status,
  type Tier,
} from "@/lib/types";

export function StatusBadge({ status }: { status: Status }) {
  const phase = STATUS_PHASE[status];
  const meta = PHASE_META[phase];
  return (
    <span
      className="chip"
      style={{ color: meta.accent, borderColor: meta.accent, background: "transparent" }}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {status}
    </span>
  );
}

export function TierBadge({ tier }: { tier: Tier }) {
  return (
    <span className="chip" title={TIER_META[tier].range}>
      {tier}
    </span>
  );
}

export function PlatformBadge({ platform }: { platform: Platform }) {
  return <span className="chip">{PLATFORM_LABEL[platform]}</span>;
}

export function CountryFlag({ country }: { country: Country }) {
  return (
    <span title={country} className="text-sm">
      {COUNTRY_FLAG[country]}
    </span>
  );
}

const CAMPAIGN_COLOR: Record<CampaignType, string> = {
  Gifted: "#0ea5e9",
  Paid: "#f59e0b",
  Affiliate: "#8b5cf6",
};

export function CampaignBadge({ type }: { type: CampaignType }) {
  return (
    <span
      className="chip"
      style={{ color: CAMPAIGN_COLOR[type], borderColor: CAMPAIGN_COLOR[type], background: "transparent" }}
    >
      {type}
    </span>
  );
}

export function ManagerBadge({ manager }: { manager: string }) {
  return (
    <span className="chip" style={{ textTransform: "capitalize" }}>
      @{manager}
    </span>
  );
}
