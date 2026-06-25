import { createServerClient } from "./supabase";
import * as mock from "./data";
import type { CollaborationView } from "./data";
import type { Campaign, Creator, Payment, StatusEvent } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

function mapCreator(r: any): Creator {
  return {
    id: r.id,
    handle: r.handle,
    name: r.name,
    platform: r.platform,
    country: r.country,
    followers: r.followers,
    tier: r.tier,
    email: r.email ?? undefined,
    manager: r.manager,
    avgViews: r.avg_views ?? undefined,
  };
}

function mapCampaign(r: any): Campaign {
  return { id: r.id, name: r.name, type: r.type, brand: r.brand };
}

function mapCollab(r: any): CollaborationView {
  return {
    id: r.id,
    creatorId: r.creator_id,
    campaignId: r.campaign_id,
    status: r.status,
    manager: r.manager,
    contentFeeKrw: r.content_fee_krw ?? undefined,
    cpv: r.cpv != null ? Number(r.cpv) : undefined,
    trackingNumber: r.tracking_number ?? undefined,
    postUrl: r.post_url ?? undefined,
    lastContact: r.last_contact ?? undefined,
    listedDate: r.listed_date ?? undefined,
    notes: r.notes ?? undefined,
    creator: mapCreator(r.creator),
    campaign: mapCampaign(r.campaign),
  };
}

const SELECT = "*, creator:creators(*), campaign:campaigns(*)";

export async function fetchCollaborationViews(): Promise<CollaborationView[]> {
  const sb = createServerClient();
  if (!sb) return mock.getCollaborationViews();
  // Supabase caps rows at 1000 per request — paginate to fetch all.
  const all: unknown[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from("collaborations")
      .select(SELECT)
      .order("last_contact", { ascending: false, nullsFirst: false })
      .range(from, from + PAGE - 1);
    if (error) break;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  if (all.length === 0) return mock.getCollaborationViews();
  return all.map(mapCollab);
}

export async function fetchCollaborationView(id: string): Promise<CollaborationView | undefined> {
  const sb = createServerClient();
  if (!sb) return mock.getCollaborationView(id);
  const { data, error } = await sb.from("collaborations").select(SELECT).eq("id", id).single();
  if (error || !data) return undefined;
  return mapCollab(data);
}

export async function fetchStatusEvents(collaborationId: string): Promise<StatusEvent[]> {
  const sb = createServerClient();
  if (!sb) return mock.getStatusEvents(collaborationId);
  const { data, error } = await sb
    .from("collaboration_status_history")
    .select("*")
    .eq("collaboration_id", collaborationId)
    .order("changed_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r: any) => ({
    id: r.id,
    collaborationId: r.collaboration_id,
    from: r.from_status,
    to: r.to_status,
    changedBy: r.changed_by,
    changedAt: r.changed_at,
    note: r.note ?? undefined,
  }));
}

export async function fetchPayment(collaborationId: string): Promise<Payment | undefined> {
  const sb = createServerClient();
  if (!sb) return mock.getPayment(collaborationId);
  const { data, error } = await sb
    .from("payments")
    .select("*")
    .eq("collaboration_id", collaborationId)
    .maybeSingle();
  if (error || !data) return undefined;
  return {
    id: data.id,
    collaborationId: data.collaboration_id,
    grossKrw: data.gross_krw,
    taxType: data.tax_type,
    taxKrw: data.tax_krw,
    netKrw: data.net_krw,
    status: data.status,
  };
}
