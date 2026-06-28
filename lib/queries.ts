import { createServerClient } from "./supabase";
import { unstable_cache } from "next/cache";
import * as mock from "./data";
import type { CollaborationView } from "./data";
import { PHASES, STATUS_PHASE, type Campaign, type Creator, type Payment, type Phase, type Status, type StatusEvent } from "./types";
import { aggregate, type AnalyticsData, type AnalyticsRecord, type Grain } from "./analytics";

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
    // email(PII)은 의도적으로 매핑 안 함 — SELECT에서 제외. Creator.email?은 향후용으로 유지.
    manager: r.manager,
    avgViews: r.avg_views ?? undefined,
    sourceSystem: r.source_system ?? undefined,
    inLegacyList: r.in_legacy_list ?? undefined,
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
    sourceSystem: r.source_system ?? undefined,
    externalRef: r.external_ref ?? undefined,
    creator: mapCreator(r.creator),
    campaign: mapCampaign(r.campaign),
  };
}

// creator는 렌더에 쓰는 컬럼만 — email(PII)은 어디서도 표시 안 하므로 전송하지 않음.
const SELECT =
  "*, creator:creators(id,handle,name,platform,country,followers,tier,manager,avg_views,source_system,in_legacy_list), campaign:campaigns(*)";
const PAGE = 1000; // Supabase caps rows at 1000/request — paginate.

// 병렬 페이지네이션 — 1000행씩 15회 순차 왕복 대신, count로 페이지 수 파악 후 동시 요청.
// 정렬에 unique id 타이브레이커를 붙여 병렬 range가 겹치거나 누락되지 않게(안정 정렬).
async function pagedAll(
  sb: any,
  select: string,
  orders: { col: string; asc: boolean }[],
  modify?: (q: any) => any
): Promise<any[]> {
  const build = (q: any) => {
    const ordered = orders.reduce((acc: any, o) => acc.order(o.col, { ascending: o.asc, nullsFirst: false }), q);
    return modify ? modify(ordered) : ordered;
  };
  const { data: first, count, error } = await build(sb.from("collaborations").select(select, { count: "exact" })).range(0, PAGE - 1);
  // 첫 페이지 에러는 연결 장애 신호 — []로 삼키면 조용한 빈 보드가 된다. throw해 error.tsx가 재시도 UI를 띄우게.
  if (error) throw new Error(`collaborations fetch failed: ${error.message ?? error}`);
  if (!first) return [];
  if (!count || count <= PAGE) return first;
  const nPages = Math.ceil(count / PAGE);
  const rest = await Promise.all(
    Array.from({ length: nPages - 1 }, (_, i) =>
      build(sb.from("collaborations").select(select))
        .range((i + 1) * PAGE, (i + 2) * PAGE - 1)
        .then((r: any) => r.data ?? [])
    )
  );
  return [first, ...rest].flat();
}

const VIEW_ORDER = [
  { col: "listed_date", asc: false },
  { col: "id", asc: true },
];
// Sourcing(발굴 풀) 제외 — 작업면 기본 로드. 14k → ~1.9k로 줄여 빠르고 캐시 가능.
const NOT_SOURCING = (q: any) => q.not("status", "in", '("Listing","Contact Completed")');

async function rawViews(includeSourcing: boolean): Promise<CollaborationView[]> {
  const sb = createServerClient();
  if (!sb) {
    const m = mock.getCollaborationViews();
    return includeSourcing ? m : m.filter((v) => STATUS_PHASE[v.status] !== "Sourcing");
  }
  const rows = await pagedAll(sb, SELECT, VIEW_ORDER, includeSourcing ? undefined : NOT_SOURCING);
  if (rows.length) return rows.map(mapCollab);
  return includeSourcing ? mock.getCollaborationViews() : [];
}

// 캐시 — 편집 시 revalidateTag("collabs")로 무효화. active(작음)는 캐시되어 재방문 즉시.
const getViewsAll = unstable_cache(() => rawViews(true), ["collab-views-all"], { tags: ["collabs"], revalidate: 300 });
const getViewsActive = unstable_cache(() => rawViews(false), ["collab-views-active"], { tags: ["collabs"], revalidate: 300 });

export async function fetchCollaborationViews(opts?: { includeSourcing?: boolean }): Promise<CollaborationView[]> {
  return opts?.includeSourcing ? getViewsAll() : getViewsActive();
}

// ---- 집계용 최소 컬럼(facts) — Overview·개발현황은 14k 전체 대신 가벼운 페이로드로 ----
export interface CollabFact {
  status: Status;
  contentFeeKrw: number;
  feeSource?: string;
  lastContact?: string;
  listedDate?: string;
  hasPostUrl: boolean;
  manager: string;
  creatorId: string;
  country: string;
  campaignType: string;
}

const FACTS_SELECT =
  "status,content_fee_krw,fee_source,last_contact,listed_date,post_url,manager,creator_id,creator:creators(country),campaign:campaigns(type)";

async function rawFacts(): Promise<CollabFact[]> {
  const sb = createServerClient();
  if (!sb) {
    return mock.getCollaborationViews().map((v) => ({
      status: v.status,
      contentFeeKrw: v.contentFeeKrw ?? 0,
      feeSource: v.feeSource,
      lastContact: v.lastContact,
      listedDate: v.listedDate,
      hasPostUrl: Boolean(v.postUrl),
      manager: v.manager,
      creatorId: v.creatorId,
      country: v.creator.country,
      campaignType: v.campaign.type,
    }));
  }
  const all = await pagedAll(sb, FACTS_SELECT, [{ col: "id", asc: true }]);
  return all.map((r) => ({
    status: r.status,
    contentFeeKrw: r.content_fee_krw ?? 0,
    feeSource: r.fee_source ?? undefined,
    lastContact: r.last_contact ?? undefined,
    listedDate: r.listed_date ?? undefined,
    hasPostUrl: Boolean(r.post_url),
    manager: r.manager,
    creatorId: r.creator_id,
    country: r.creator?.country ?? "?",
    campaignType: r.campaign?.type ?? "?",
  }));
}

const getFacts = unstable_cache(rawFacts, ["collab-facts"], { tags: ["collabs"], revalidate: 300 });

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
  const facts = await getFacts();
  const byPhase: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byCountry: Record<string, number> = {};
  const byCampaign: Record<string, number> = {};
  const creatorIds = new Set<string>();
  let withListedDate = 0;
  let withPostUrl = 0;
  for (const f of facts) {
    const phase = STATUS_PHASE[f.status];
    byPhase[phase] = (byPhase[phase] ?? 0) + 1;
    byStatus[f.status] = (byStatus[f.status] ?? 0) + 1;
    byCountry[f.country] = (byCountry[f.country] ?? 0) + 1;
    byCampaign[f.campaignType] = (byCampaign[f.campaignType] ?? 0) + 1;
    creatorIds.add(f.creatorId);
    if (f.listedDate) withListedDate++;
    if (f.hasPostUrl) withPostUrl++;
  }
  return {
    total: facts.length,
    creators: creatorIds.size,
    byPhase,
    byStatus,
    byCountry,
    byCampaign,
    withListedDate,
    withPostUrl,
  };
}

// ---- Logistics / products / provenance (AC-7) — /status 노출용 최소 집계 ----

export interface LogisticsStats {
  shipments: number;
  feeKrwTotal: number; // 전체 물류비 합
  feeKrwExclHH: number; // H&H(타브랜드) 제외 — 기본 표기값
  products: { name: string; cogsKrw: number | null }[];
  sourceDistribution: Record<string, number>; // collaborations by source_system
}

async function rawLogisticsStats(): Promise<LogisticsStats> {
  const sb = createServerClient();
  const empty: LogisticsStats = {
    shipments: 0,
    feeKrwTotal: 0,
    feeKrwExclHH: 0,
    products: [],
    sourceDistribution: {},
  };
  if (!sb) return empty;

  // 독립 쿼리 6개 — 직렬 왕복 대신 Promise.all 병렬(왕복 시간 ~1/3).
  const [shipRes, feesRes, prodsRes, totalRes, legacyRes, untaggedRes] = await Promise.all([
    sb.from("shipments").select("*", { count: "exact", head: true }),
    sb.from("shipments").select("fee_krw, brand_tag"),
    sb.from("products").select("name, cogs_krw").order("name"),
    sb.from("collaborations").select("*", { count: "exact", head: true }),
    sb.from("collaborations").select("*", { count: "exact", head: true }).eq("source_system", "legacy_contact_list"),
    sb.from("collaborations").select("*", { count: "exact", head: true }).is("source_system", null),
  ]);

  const shipments = shipRes.count ?? 0;
  let feeKrwTotal = 0;
  let feeKrwExclHH = 0;
  for (const f of (feesRes.data ?? []) as { fee_krw: number | null; brand_tag: string | null }[]) {
    const v = Number(f.fee_krw) || 0;
    feeKrwTotal += v;
    if (f.brand_tag !== "H&H") feeKrwExclHH += v;
  }
  const products = ((prodsRes.data ?? []) as { name: string; cogs_krw: number | null }[]).map((p) => ({
    name: p.name,
    cogsKrw: p.cogs_krw != null ? Number(p.cogs_krw) : null,
  }));

  // source_system 분포 — 소스가 소수라 known 값별 count(head)로 가볍게.
  const total = totalRes.count ?? 0;
  const legacy = legacyRes.count ?? 0;
  const untagged = untaggedRes.count ?? 0;
  const sourceDistribution: Record<string, number> = { legacy_contact_list: legacy };
  const other = total - legacy - untagged;
  if (other > 0) sourceDistribution["기타"] = other;
  if (untagged > 0) sourceDistribution["(미태깅)"] = untagged;

  return { shipments: shipments ?? 0, feeKrwTotal, feeKrwExclHH, products, sourceDistribution };
}

export const fetchLogisticsStats = unstable_cache(rawLogisticsStats, ["logistics-stats"], {
  tags: ["collabs"],
  revalidate: 300,
});

// ---- Overview (보는 화면) — 정직 KPI. 가짜 약정액 금지, fee_source 게이트. ----

// contentLive(콘텐츠 산출물 카운트)는 업로드도 산출물이므로 Uploaded 포함이 맞다.
// 그러나 Executed fee(시트 추정 실집행)는 더 보수적으로 — 게시 링크가 있는 Completed만.
// Payment Pending은 '계획된 지급'이라 의도적 제외(실집행 ≠ 지급 예정). 실제 현금
// 집행 cash-out은 payments 테이블(status=paid)이 정본이고, 있으면 그쪽을 우선한다.
const DONE_STATUSES = new Set(["Content Uploaded", "Completed"]); // 콘텐츠 산출물(라이브) 카운트용
const EXECUTED_STATUSES = new Set(["Completed"]); // 시트 추정 실집행 게이트(+ 게시링크 보유)
const STUCK_DAYS = 14;

export interface OverviewStats {
  total: number;
  creators: number;
  discoveryPool: number; // Sourcing — 발굴 풀(파이프라인 건강도에서 분리)
  activePipeline: number; // 진행 중(Drop·Sourcing 제외)
  dropped: number;
  contentLive: number; // 콘텐츠 업로드/완료 — 실제 산출물
  stuck: number; // active 중 14일+ 소통 없음(미기록 포함)
  executedFeeKrw: number; // payments 기록 있으면 실집행(paid gross), 없으면 시트 추정
  executedFeeCount: number;
  executedFromPayments: boolean; // true=payments 테이블 실값, false=시트 추정
  pipelineValueKrw: number; // sheet_krw & active — 제안가(약정 아님)
  pipelineValueCount: number;
  paymentsRecorded: number; // payments 테이블 행수(현재 0)
  // 근거(개발단계 검증용): 합산에 무엇이 포함/제외됐는지 원장
  feeLedger: {
    sheetKrw: { count: number; sum: number }; // KRW 확정 — 합산 포함
    unverified: { count: number; sum: number }; // 통화 미확인 — 합산 제외
    unknownSource: { count: number; sum: number }; // fee>0인데 출처 미상 — 감사 구멍(정상이면 0)
    noFee: number; // fee 없음(fee<=0, JP 참여율 차단분 포함)
  };
  funnel: { phase: Phase; count: number }[]; // 진행 퍼널(Sourcing 제외)
  byCountryActive: Record<string, number>;
  byManagerActive: Record<string, number>;
  byCampaignActive: Record<string, number>;
}

function daysSince(iso?: string): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return null; // 잘못된 날짜(예: 2026-04-31)는 NaN → null(미상=stuck로 집계)
  return Math.floor((Date.now() - t) / 86_400_000);
}

export async function fetchOverviewStats(): Promise<OverviewStats> {
  const facts = await getFacts();
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
    unknownSource: { count: 0, sum: 0 },
    noFee: 0,
  };
  const funnelCount: Record<string, number> = {};
  const byCountryActive: Record<string, number> = {};
  const byManagerActive: Record<string, number> = {};
  const byCampaignActive: Record<string, number> = {};

  for (const f of facts) {
    creatorIds.add(f.creatorId);
    const phase = STATUS_PHASE[f.status];
    const fee = f.contentFeeKrw;
    const trusted = f.feeSource === "sheet_krw";

    // fee 원장(전체 기준) — 합산 근거. 무엇이 포함/제외됐는지 감사용.
    if (fee > 0 && trusted) {
      feeLedger.sheetKrw.count++;
      feeLedger.sheetKrw.sum += fee;
    } else if (fee > 0 && f.feeSource === "unverified") {
      feeLedger.unverified.count++;
      feeLedger.unverified.sum += fee;
    } else if (fee > 0) {
      // 금액은 있으나 출처가 sheet_krw/unverified가 아님 — 조용히 사라지던 감사 구멍을 포착
      feeLedger.unknownSource.count++;
      feeLedger.unknownSource.sum += fee;
    } else {
      feeLedger.noFee++;
    }

    if (f.status === "Drop") {
      dropped++;
      continue;
    }
    if (phase === "Sourcing") {
      discoveryPool++;
      continue;
    }
    // 여기부터 = active pipeline (Drop·Sourcing 제외)
    activePipeline++;
    byCountryActive[f.country] = (byCountryActive[f.country] ?? 0) + 1;
    byManagerActive[f.manager] = (byManagerActive[f.manager] ?? 0) + 1;
    byCampaignActive[f.campaignType] = (byCampaignActive[f.campaignType] ?? 0) + 1;
    funnelCount[phase] = (funnelCount[phase] ?? 0) + 1;

    if (DONE_STATUSES.has(f.status)) contentLive++;
    const d = daysSince(f.lastContact);
    if (d === null || d >= STUCK_DAYS) stuck++;

    if (trusted && fee > 0) {
      pipelineValueKrw += fee;
      pipelineValueCount++;
      // 실집행 추정 = 유가 + Completed + 게시링크 보유. 업로드만 된(미완·미게시) 건은
      // 실집행으로 과대계상하지 않는다. payments 실값이 있으면 아래에서 그쪽으로 대체.
      if (f.campaignType === "Paid" && EXECUTED_STATUSES.has(f.status) && f.hasPostUrl) {
        executedFeeKrw += fee;
        executedFeeCount++;
      }
    }
  }

  // payments 테이블 실집행 — 기록 있으면 Executed fee를 실값(paid gross)으로 전환
  let paymentsRecorded = 0,
    paidGross = 0,
    paidCount = 0;
  const sb = createServerClient();
  if (sb) {
    // 합산이 목적 — 두 컬럼만. 안전 상한(테이블 성장 시 무제한 로드 방지); 초과 규모면 집계 RPC로 전환.
    const { data: pays } = await sb.from("payments").select("gross_krw, status").limit(5000);
    if (pays) {
      paymentsRecorded = pays.length;
      for (const p of pays as { gross_krw: number; status: string }[]) {
        if (p.status === "paid") {
          paidGross += Number(p.gross_krw) || 0;
          paidCount++;
        }
      }
    }
  }
  const executedFromPayments = paidCount > 0;

  return {
    total: facts.length,
    creators: creatorIds.size,
    discoveryPool,
    activePipeline,
    dropped,
    contentLive,
    stuck,
    executedFeeKrw: executedFromPayments ? paidGross : executedFeeKrw,
    executedFeeCount: executedFromPayments ? paidCount : executedFeeCount,
    executedFromPayments,
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
    paidAt: data.paid_at ? String(data.paid_at).slice(0, 10) : undefined,
  };
}

// ---- Analytics (onair_2026 content_pieces 성과 집계) ----
// content_pieces → collaboration → creator(country·tier) embed. onair_2026 정본만(645건 < 1000 cap).
async function rawAnalyticsRecords(): Promise<AnalyticsRecord[]> {
  const sb = createServerClient();
  if (!sb) return []; // content_pieces mock 없음 → 빈 상태(AC-8 처리)
  const { data, error } = await sb
    .from("content_pieces")
    .select(
      "category,posted_at,scheduled_post_date,views,likes,comments,reposts,saves,shares,collaboration:collaborations(creator:creators(country,tier))"
    )
    .eq("source_system", "onair_2026")
    .limit(1000);
  if (error) throw new Error(`content_pieces fetch failed: ${error.message ?? error}`);
  if (!data) return [];
  return data.map((r: any) => ({
    category: r.category ?? null,
    postedAt: r.posted_at ? String(r.posted_at).slice(0, 10) : null,
    scheduledPostDate: r.scheduled_post_date ? String(r.scheduled_post_date).slice(0, 10) : null,
    views: r.views ?? null,
    likes: r.likes ?? null,
    comments: r.comments ?? null,
    reposts: r.reposts ?? null,
    saves: r.saves ?? null,
    shares: r.shares ?? null,
    country: r.collaboration?.creator?.country ?? null,
    tier: r.collaboration?.creator?.tier ?? null,
  }));
}

const getAnalyticsRecords = unstable_cache(rawAnalyticsRecords, ["analytics-records"], { tags: ["collabs"], revalidate: 300 });

export async function fetchAnalytics(grain: Grain, country = "all"): Promise<AnalyticsData> {
  const records = await getAnalyticsRecords();
  return aggregate(records, grain, country);
}
