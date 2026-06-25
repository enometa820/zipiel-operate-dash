// Domain model — derived from the live "2026 Contact List" sheet (On-Air Sheet, 39 cols)
// normalized into the 6-table model. See research/00-조사-종합.md.

export type Platform =
  | "instagram"
  | "tiktok"
  | "x"
  | "threads"
  | "xiaohongshu"
  | "douyin"
  | "youtube";

export type Country = "MY" | "SG" | "TW" | "JP" | "KR" | "HK" | "CN" | "US";

export type Tier = "Nano" | "Micro" | "Mid" | "Macro" | "Mega";

export type CampaignType = "Gifted" | "Paid" | "Affiliate";

// Standardized status machine (unifies the KR/EN mixed labels across country tabs)
export type Status =
  | "Listed"
  | "Contacted"
  | "In Discussion"
  | "Rate Inquiry"
  | "Confirmed"
  | "Contract"
  | "Shipping Info"
  | "Shipping"
  | "Guidelines Sent"
  | "In Production"
  | "Published"
  | "Payment Pending"
  | "Completed"
  | "Dropped";

export type Phase =
  | "Sourcing"
  | "Negotiation"
  | "Fulfillment"
  | "Content"
  | "Payment"
  | "Done";

// Tax handling for payouts — NOT a flat 3.3% for foreign creators.
// See research/00-조사-종합.md §8.
export type TaxType =
  | "kr_resident_3.3" // Korean resident: 3.3% withholding
  | "nonresident_domestic" // performed in KR: 22% / treaty rate
  | "nonresident_overseas" // performed abroad: no withholding, pay gross
  | "none";

export interface Creator {
  id: string;
  handle: string;
  name: string;
  platform: Platform;
  country: Country;
  followers: number;
  tier: Tier;
  email?: string;
  manager: string; // sol / anna / nhi ...
  avgViews?: number; // avg views of last 6 posts (for CPV)
}

export interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  brand: string;
}

export interface Collaboration {
  id: string;
  creatorId: string;
  campaignId: string;
  status: Status;
  manager: string;
  contentFeeKrw?: number; // gross fee in KRW
  cpv?: number; // cost per view
  trackingNumber?: string;
  postUrl?: string;
  lastContact?: string; // ISO date
  listedDate?: string;
  notes?: string;
}

export interface StatusEvent {
  id: string;
  collaborationId: string;
  from: Status | null;
  to: Status;
  changedBy: string;
  changedAt: string; // ISO
  note?: string;
}

export interface Payment {
  id: string;
  collaborationId: string;
  grossKrw: number;
  taxType: TaxType;
  taxKrw: number;
  netKrw: number;
  status: "pending" | "paid";
}

// ---- Status → Phase mapping (15 stages folded into 6 kanban columns) ----

export const STATUS_PHASE: Record<Status, Phase | "Dropped"> = {
  Listed: "Sourcing",
  Contacted: "Sourcing",
  "In Discussion": "Negotiation",
  "Rate Inquiry": "Negotiation",
  Confirmed: "Negotiation",
  Contract: "Fulfillment",
  "Shipping Info": "Fulfillment",
  Shipping: "Fulfillment",
  "Guidelines Sent": "Content",
  "In Production": "Content",
  Published: "Content",
  "Payment Pending": "Payment",
  Completed: "Done",
  Dropped: "Dropped",
};

export const PHASES: Phase[] = [
  "Sourcing",
  "Negotiation",
  "Fulfillment",
  "Content",
  "Payment",
  "Done",
];

export const PHASE_STATUSES: Record<Phase, Status[]> = {
  Sourcing: ["Listed", "Contacted"],
  Negotiation: ["In Discussion", "Rate Inquiry", "Confirmed"],
  Fulfillment: ["Contract", "Shipping Info", "Shipping"],
  Content: ["Guidelines Sent", "In Production", "Published"],
  Payment: ["Payment Pending"],
  Done: ["Completed"],
};

export const PHASE_META: Record<
  Phase | "Dropped",
  { label: string; accent: string; dot: string }
> = {
  Sourcing: { label: "Sourcing", accent: "var(--phase-sourcing)", dot: "bg-slate-400" },
  Negotiation: { label: "Negotiation", accent: "var(--phase-negotiation)", dot: "bg-amber-400" },
  Fulfillment: { label: "Fulfillment", accent: "var(--phase-fulfillment)", dot: "bg-sky-400" },
  Content: { label: "Content", accent: "var(--phase-content)", dot: "bg-violet-400" },
  Payment: { label: "Payment", accent: "var(--phase-payment)", dot: "bg-emerald-400" },
  Done: { label: "Done", accent: "var(--phase-done)", dot: "bg-teal-500" },
  Dropped: { label: "Dropped", accent: "var(--phase-dropped)", dot: "bg-rose-400" },
};

export const TIER_META: Record<Tier, { label: string; range: string }> = {
  Nano: { label: "Nano", range: "1K–10K" },
  Micro: { label: "Micro", range: "10K–100K" },
  Mid: { label: "Mid", range: "100K–500K" },
  Macro: { label: "Macro", range: "500K–1M" },
  Mega: { label: "Mega", range: "1M+" },
};

export const COUNTRY_FLAG: Record<Country, string> = {
  MY: "🇲🇾",
  SG: "🇸🇬",
  TW: "🇹🇼",
  JP: "🇯🇵",
  KR: "🇰🇷",
  HK: "🇭🇰",
  CN: "🇨🇳",
  US: "🇺🇸",
};

export const PLATFORM_LABEL: Record<Platform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X",
  threads: "Threads",
  xiaohongshu: "RED",
  douyin: "Douyin",
  youtube: "YouTube",
};
