import { createServerClient } from "./supabase";
import * as mock from "./data";
import type { CollaborationView } from "./data";
import { PHASES, STATUS_PHASE, type Campaign, type Creator, type Payment, type Phase, type StatusEvent } from "./types";

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
    feeSource: r.fee_source ?? undefined,
    cpv: r.cpv != null ? Number(r.cpv) : undefined,
    trackingNumber: r.tracking_number ?? undefined,
    postUrl: r.post_url ?? undefined,
    lastContact: r.last_contact ?? undefined,
    listedDate: r.listed_date ?? undefined,
    scheduledPostDate: r.scheduled_post_date ?? undefined,
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
      .order("listed_date", { ascending: false, nullsFirst: false })
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

export interface Stats {
  total: number;
  creators: number;
  byPhase: Record<string, number>;
  byStatus: Record<string, number>;
  byCountry: Record<string, number>;
  byCampaign: Record<string, number>;
  withListedDate: number;
  withPostUrl: number;
}

export async function fetchStats(): Promise<Stats> {
  const views = await fetchCollaborationViews();
  const byPhase: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byCountry: Record<string, number> = {};
  const byCampaign: Record<string, number> = {};
  const creatorIds = new Set<string>();
  let withListedDate = 0;
  let withPostUrl = 0;
  for (const v of views) {
    const phase = STATUS_PHASE[v.status];
    byPhase[phase] = (byPhase[phase] ?? 0) + 1;
    byStatus[v.status] = (byStatus[v.status] ?? 0) + 1;
    byCountry[v.creator.country] = (byCountry[v.creator.country] ?? 0) + 1;
    byCampaign[v.campaign.type] = (byCampaign[v.campaign.type] ?? 0) + 1;
    creatorIds.add(v.creatorId);
    if (v.listedDate) withListedDate++;
    if (v.postUrl) withPostUrl++;
  }
  return {
    total: views.length,
    creators: creatorIds.size,
    byPhase,
    byStatus,
    byCountry,
    byCampaign,
    withListedDate,
    withPostUrl,
  };
}

// ---- Overview (보는 화면) — 정직 KPI. 가짜 약정액 금지, fee_source 게이트. ----

const DONE_STATUSES = new Set(["Content Uploaded", "Completed"]);
const STUCK_DAYS = 14;

export interface OverviewStats {
  total: number;
  creators: number;
  discoveryPool: number; // Sourcing — 발굴 풀(파이프라인 건강도에서 분리)
  activePipeline: number; // 진행 중(Drop·Sourcing 제외)
  dropped: number;
  contentLive: number; // 콘텐츠 업로드/완료 — 실제 산출물
  stuck: number; // active 중 14일+ 소통 없음(미기록 포함)
  executedFeeKrw: number; // sheet_krw & Paid & 콘텐츠 라이브/완료 — 집행에 가장 근접
  executedFeeCount: number;
  pipelineValueKrw: number; // sheet_krw & active — 제안가(약정 아님)
  pipelineValueCount: number;
  paymentsRecorded: number; // payments 테이블 행수(현재 0)
  // 근거(개발단계 검증용): 합산에 무엇이 포함/제외됐는지 원장
  feeLedger: {
    sheetKrw: { count: number; sum: number }; // KRW 확정 — 합산 포함
    unverified: { count: number; sum: number }; // 통화 미확인 — 합산 제외
    noFee: number; // fee 없음(JP 참여율 차단분 포함)
  };
  funnel: { phase: Phase; count: number }[]; // 진행 퍼널(Sourcing 제외)
  byCountryActive: Record<string, number>;
  byManagerActive: Record<string, number>;
  byCampaignActive: Record<string, number>;
}

function daysSince(iso?: string): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export async function fetchOverviewStats(): Promise<OverviewStats> {
  const views = await fetchCollaborationViews();
  const creatorIds = new Set<string>();
  let discoveryPool = 0,
    dropped = 0,
    activePipeline = 0,
    contentLive = 0,
    stuck = 0,
    executedFeeKrw = 0,
    executedFeeCount = 0,
    pipelineValueKrw = 0,
    pipelineValueCount = 0;
  const feeLedger = {
    sheetKrw: { count: 0, sum: 0 },
    unverified: { count: 0, sum: 0 },
    noFee: 0,
  };
  const funnelCount: Record<string, number> = {};
  const byCountryActive: Record<string, number> = {};
  const byManagerActive: Record<string, number> = {};
  const byCampaignActive: Record<string, number> = {};

  for (const v of views) {
    creatorIds.add(v.creatorId);
    const phase = STATUS_PHASE[v.status];
    const fee = v.contentFeeKrw ?? 0;
    const trusted = v.feeSource === "sheet_krw";

    // fee 원장(전체 기준) — 합산 근거. 무엇이 포함/제외됐는지 감사용.
    if (fee > 0 && trusted) {
      feeLedger.sheetKrw.count++;
      feeLedger.sheetKrw.sum += fee;
    } else if (fee > 0 && v.feeSource === "unverified") {
      feeLedger.unverified.count++;
      feeLedger.unverified.sum += fee;
    } else {
      feeLedger.noFee++;
    }

    if (v.status === "Drop") {
      dropped++;
      continue;
    }
    if (phase === "Sourcing") {
      discoveryPool++;
      continue;
    }
    // 여기부터 = active pipeline (Drop·Sourcing 제외)
    activePipeline++;
    byCountryActive[v.creator.country] = (byCountryActive[v.creator.country] ?? 0) + 1;
    byManagerActive[v.manager] = (byManagerActive[v.manager] ?? 0) + 1;
    byCampaignActive[v.campaign.type] = (byCampaignActive[v.campaign.type] ?? 0) + 1;
    funnelCount[phase] = (funnelCount[phase] ?? 0) + 1;

    if (DONE_STATUSES.has(v.status)) contentLive++;
    const d = daysSince(v.lastContact);
    if (d === null || d >= STUCK_DAYS) stuck++;

    if (trusted && fee > 0) {
      pipelineValueKrw += fee;
      pipelineValueCount++;
      if (v.campaign.type === "Paid" && DONE_STATUSES.has(v.status)) {
        executedFeeKrw += fee;
        executedFeeCount++;
      }
    }
  }

  // payments 테이블 실집행 기록(현재 0행 — 정직 표시용)
  let paymentsRecorded = 0;
  const sb = createServerClient();
  if (sb) {
    const { count } = await sb.from("payments").select("*", { count: "exact", head: true });
    paymentsRecorded = count ?? 0;
  }

  return {
    total: views.length,
    creators: creatorIds.size,
    discoveryPool,
    activePipeline,
    dropped,
    contentLive,
    stuck,
    executedFeeKrw,
    executedFeeCount,
    pipelineValueKrw,
    pipelineValueCount,
    paymentsRecorded,
    feeLedger,
    funnel: PHASES.filter((p) => p !== "Sourcing").map((p) => ({ phase: p, count: funnelCount[p] ?? 0 })),
    byCountryActive,
    byManagerActive,
    byCampaignActive,
  };
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
