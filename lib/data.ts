// Mock data layer — stands in for Supabase until the project DB is connected.
// All creators here are FICTIONAL (no real PII). The real sheet snapshot
// (research/sheet-snapshot/) holds the actual operational data and is gitignored.

import type { Campaign, Collaboration, Creator, Payment, StatusEvent } from "./types";

export const campaigns: Campaign[] = [
  { id: "cmp-1", name: "Clay Mask Global Q3", type: "Gifted", brand: "zipiel" },
  { id: "cmp-2", name: "Tone-Up Cream JP", type: "Paid", brand: "zipiel" },
  { id: "cmp-3", name: "Serum Affiliate TW", type: "Affiliate", brand: "zipiel" },
];

export const creators: Creator[] = [
  { id: "cr-1", handle: "glow_gummi", name: "Glow Gummi", platform: "tiktok", country: "MY", followers: 8200, tier: "Nano", manager: "sol", avgViews: 12000 },
  { id: "cr-2", handle: "aiko.skin", name: "Aiko", platform: "instagram", country: "JP", followers: 142000, tier: "Mid", manager: "anna", avgViews: 51000 },
  { id: "cr-3", handle: "lele_amanslife", name: "Lele", platform: "threads", country: "TW", followers: 33000, tier: "Micro", manager: "sol", avgViews: 9800 },
  { id: "cr-4", handle: "sg_yuncat", name: "Yun", platform: "tiktok", country: "SG", followers: 21500, tier: "Micro", manager: "sol", avgViews: 17400 },
  { id: "cr-5", handle: "dumpling_soda", name: "Dumpling Soda", platform: "instagram", country: "TW", followers: 410000, tier: "Macro", manager: "nhi", avgViews: 120000 },
  { id: "cr-6", handle: "mei.routine", name: "Mei", platform: "xiaohongshu", country: "CN", followers: 88000, tier: "Micro", manager: "anna", avgViews: 26000 },
  { id: "cr-7", handle: "hana_babe", name: "Hana", platform: "instagram", country: "JP", followers: 1250000, tier: "Mega", manager: "anna", avgViews: 340000 },
  { id: "cr-8", handle: "tang_tui", name: "Tang Tui", platform: "tiktok", country: "TW", followers: 64000, tier: "Micro", manager: "nhi", avgViews: 41000 },
  { id: "cr-9", handle: "nadia.beauty", name: "Nadia", platform: "tiktok", country: "MY", followers: 9700, tier: "Nano", manager: "sol", avgViews: 8200 },
  { id: "cr-10", handle: "yuki.care", name: "Yuki", platform: "x", country: "JP", followers: 4570, tier: "Nano", manager: "anna", avgViews: 3100 },
  { id: "cr-11", handle: "sora_glow", name: "Sora", platform: "instagram", country: "SG", followers: 175000, tier: "Mid", manager: "sol", avgViews: 62000 },
  { id: "cr-12", handle: "chen.makeup", name: "Chen", platform: "instagram", country: "TW", followers: 540000, tier: "Macro", manager: "nhi", avgViews: 150000 },
];

export const collaborations: Collaboration[] = [
  { id: "co-1", creatorId: "cr-1", campaignId: "cmp-1", status: "Listing", manager: "sol", listedDate: "2026-06-22", lastContact: "2026-06-22" },
  { id: "co-2", creatorId: "cr-9", campaignId: "cmp-1", status: "Contact Completed", manager: "sol", listedDate: "2026-06-18", lastContact: "2026-06-23" },
  { id: "co-3", creatorId: "cr-4", campaignId: "cmp-1", status: "Negotiating", manager: "sol", listedDate: "2026-06-10", lastContact: "2026-06-24", notes: "Asked about gifted collab" },
  { id: "co-4", creatorId: "cr-3", campaignId: "cmp-3", status: "Rate Inquiry", manager: "sol", contentFeeKrw: 300000, lastContact: "2026-06-23" },
  { id: "co-5", creatorId: "cr-2", campaignId: "cmp-2", status: "Confirmed to Proceed", manager: "anna", contentFeeKrw: 280000, cpv: 5.5, lastContact: "2026-06-21" },
  { id: "co-6", creatorId: "cr-11", campaignId: "cmp-2", status: "Contract", manager: "sol", contentFeeKrw: 450000, lastContact: "2026-06-20" },
  { id: "co-7", creatorId: "cr-8", campaignId: "cmp-3", status: "Shipping", manager: "nhi", trackingNumber: "TW884021", lastContact: "2026-06-19" },
  { id: "co-8", creatorId: "cr-6", campaignId: "cmp-1", status: "Guideline Sent", manager: "anna", lastContact: "2026-06-18" },
  { id: "co-9", creatorId: "cr-5", campaignId: "cmp-1", status: "Content in Production", manager: "nhi", lastContact: "2026-06-17" },
  { id: "co-10", creatorId: "cr-2", campaignId: "cmp-2", status: "Content Uploaded", manager: "anna", postUrl: "https://instagram.com/p/xyz", cpv: 4.9, lastContact: "2026-06-15" },
  { id: "co-11", creatorId: "cr-7", campaignId: "cmp-2", status: "On Hold", manager: "anna", contentFeeKrw: 1800000, cpv: 5.3, postUrl: "https://x.com/post", lastContact: "2026-06-12" },
  { id: "co-12", creatorId: "cr-12", campaignId: "cmp-3", status: "Completed", manager: "nhi", contentFeeKrw: 600000, cpv: 4.0, postUrl: "https://instagram.com/p/abc", lastContact: "2026-06-10" },
  { id: "co-13", creatorId: "cr-10", campaignId: "cmp-1", status: "Drop", manager: "anna", lastContact: "2026-06-08", notes: "No reply 1 month+" },
];

export const statusEvents: StatusEvent[] = [
  { id: "ev-1", collaborationId: "co-11", from: "Content Uploaded", to: "On Hold", changedBy: "anna", changedAt: "2026-06-12T09:00:00Z" },
  { id: "ev-2", collaborationId: "co-11", from: "Content in Production", to: "Content Uploaded", changedBy: "anna", changedAt: "2026-06-10T09:00:00Z" },
  { id: "ev-3", collaborationId: "co-11", from: "Confirmed to Proceed", to: "Content in Production", changedBy: "anna", changedAt: "2026-06-05T09:00:00Z" },
];

export const payments: Payment[] = [
  // Japanese creator performing abroad → no KR withholding (pay gross). See §8.
  { id: "pay-1", collaborationId: "co-11", grossKrw: 1800000, taxType: "nonresident_overseas", taxKrw: 0, netKrw: 1800000, status: "pending" },
  { id: "pay-2", collaborationId: "co-12", grossKrw: 600000, taxType: "nonresident_overseas", taxKrw: 0, netKrw: 600000, status: "paid" },
];

// ---- accessors (swap for Supabase queries later) ----

export interface CollaborationView extends Collaboration {
  creator: Creator;
  campaign: Campaign;
}

export function getCollaborationViews(): CollaborationView[] {
  return collaborations.map((co) => ({
    ...co,
    creator: creators.find((c) => c.id === co.creatorId)!,
    campaign: campaigns.find((c) => c.id === co.campaignId)!,
  }));
}

export function getCollaborationView(id: string): CollaborationView | undefined {
  return getCollaborationViews().find((c) => c.id === id);
}

export function getStatusEvents(collaborationId: string): StatusEvent[] {
  return statusEvents
    .filter((e) => e.collaborationId === collaborationId)
    .sort((a, b) => (a.changedAt < b.changedAt ? 1 : -1));
}

export function getPayment(collaborationId: string): Payment | undefined {
  return payments.find((p) => p.collaborationId === collaborationId);
}
