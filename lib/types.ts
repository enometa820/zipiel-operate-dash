// Domain model — status machine matches effie's canonical sheet dropdown
// (15 statuses, EN labels per the sheet) exactly. See research/00-조사-종합.md.

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

// Canonical status enum — EN labels exactly as effie's sheet dropdown.
export type Status =
  | "Listing"
  | "Contact Completed"
  | "Negotiating"
  | "Rate Inquiry"
  | "Confirmed to Proceed"
  | "Contract"
  | "Request Shipping Information"
  | "Shipping"
  | "Guideline Sent"
  | "Content in Production"
  | "Content Uploaded"
  | "Payment Pending"
  | "Simple Seeding/PR"
  | "Completed"
  | "Drop";

// Korean labels (sheet is bilingual; EN is primary per effie, KO for tooltip/ETL).
export const STATUS_KO: Record<Status, string> = {
  Listing: "리스트업",
  "Contact Completed": "컨택 완료",
  Negotiating: "협업 조건 조율",
  "Rate Inquiry": "단가 문의",
  "Confirmed to Proceed": "진행 확정",
  Contract: "계약서",
  "Request Shipping Information": "배송 정보 요청",
  Shipping: "배송 중",
  "Guideline Sent": "가이드라인 전달",
  "Content in Production": "콘텐츠 제작 중",
  "Content Uploaded": "콘텐츠 업로드 완료",
  "Payment Pending": "지급 대기",
  "Simple Seeding/PR": "단순시딩/PR",
  Completed: "협업완료",
  Drop: "드랍",
};

// canonical ordering (matches effie's dropdown), Drop last
export const STATUSES: Status[] = [
  "Listing",
  "Contact Completed",
  "Negotiating",
  "Rate Inquiry",
  "Confirmed to Proceed",
  "Contract",
  "Request Shipping Information",
  "Shipping",
  "Guideline Sent",
  "Content in Production",
  "Content Uploaded",
  "Payment Pending",
  "Simple Seeding/PR",
  "Completed",
  "Drop",
];

export type Phase =
  | "Sourcing"
  | "Negotiation"
  | "Fulfillment"
  | "Content"
  | "Payment"
  | "Done";

// Board column = Phase, plus two off-pipeline lanes (Seeding, Dropped).
export type BoardColumn = Phase | "Seeding" | "Dropped";

export type TaxType =
  | "kr_resident_3.3"
  | "nonresident_domestic"
  | "nonresident_overseas"
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
  manager: string;
  avgViews?: number;
  sourceSystem?: string; // provenance — legacy_contact_list / onair_2026 / crawler ...
  inLegacyList?: boolean; // 기존 컨택 리스트(발굴 풀) 중복 인원 표시·필터용
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
  contentFeeKrw?: number;
  feeSource?: string; // sheet_krw | unverified | undefined — KPI 신뢰 게이트
  cpv?: number;
  trackingNumber?: string;
  postUrl?: string;
  lastContact?: string;
  listedDate?: string;
  scheduledPostDate?: string;
  notes?: string;
  sourceSystem?: string; // provenance
  externalRef?: string; // source natural key (e.g. legacy:{handle}:{platform})
}

export interface Product {
  id: string;
  name: string;
  sku?: string;
  cogsKrw?: number;
  aliases: string[];
}

export interface Shipment {
  invoiceNo: string;
  sourceSystem?: string; // provenance — 'ship_sheet'
  carrier?: string;
  requestDate?: string;
  processedDate?: string;
  weightG?: number;
  feeKrw?: number;
  countryCode?: string;
  brandTag?: string;
  customsNo?: string;
  deliveryStatus?: string;
  matchStatus: string;
}

export interface StatusEvent {
  id: string;
  collaborationId: string;
  from: Status | null;
  to: Status;
  changedBy: string;
  changedAt: string;
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
  paidAt?: string; // YYYY-MM-DD (status=paid일 때)
}

// ---- Status → board column (effie's 15 stages folded to columns) ----

export const STATUS_PHASE: Record<Status, BoardColumn> = {
  Listing: "Sourcing",
  "Contact Completed": "Sourcing",
  Negotiating: "Negotiation",
  "Rate Inquiry": "Negotiation",
  "Confirmed to Proceed": "Negotiation",
  Contract: "Fulfillment",
  "Request Shipping Information": "Fulfillment",
  Shipping: "Fulfillment",
  "Guideline Sent": "Content",
  "Content in Production": "Content",
  "Content Uploaded": "Content",
  "Payment Pending": "Payment",
  Completed: "Done",
  "Simple Seeding/PR": "Seeding",
  Drop: "Dropped",
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
  Sourcing: ["Listing", "Contact Completed"],
  Negotiation: ["Negotiating", "Rate Inquiry", "Confirmed to Proceed"],
  Fulfillment: ["Contract", "Request Shipping Information", "Shipping"],
  Content: ["Guideline Sent", "Content in Production", "Content Uploaded"],
  Payment: ["Payment Pending"],
  Done: ["Completed"],
};

export const PHASE_META: Record<
  BoardColumn,
  { label: string; accent: string; dot: string }
> = {
  Sourcing: { label: "Sourcing", accent: "var(--phase-sourcing)", dot: "bg-slate-400" },
  Negotiation: { label: "Negotiation", accent: "var(--phase-negotiation)", dot: "bg-amber-400" },
  Fulfillment: { label: "Fulfillment", accent: "var(--phase-fulfillment)", dot: "bg-sky-400" },
  Content: { label: "Content", accent: "var(--phase-content)", dot: "bg-violet-400" },
  Payment: { label: "Payment", accent: "var(--phase-payment)", dot: "bg-emerald-400" },
  Done: { label: "Done", accent: "var(--phase-done)", dot: "bg-teal-500" },
  Seeding: { label: "Seeding / PR", accent: "var(--phase-seeding)", dot: "bg-fuchsia-400" },
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

// effie 시트 Platform 컬럼 표기 정본(IG·TT·TR·YT·X 약칭 + xiaohongshu·douyin 풀네임).
// "RED"는 시트에 없는 라벨이라 폐기 — 시트 실제 용어로 정렬(조사: Platform 컬럼 xiaohongshu 3,385건·RED 0건).
export const PLATFORM_LABEL: Record<Platform, string> = {
  instagram: "IG",
  tiktok: "TT",
  x: "X",
  threads: "TR",
  xiaohongshu: "Xiaohongshu",
  douyin: "Douyin",
  youtube: "YT",
};
