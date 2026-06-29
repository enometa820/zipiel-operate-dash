"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createServerClient } from "@/lib/supabase";
import { fetchPayment, fetchStatusEvents } from "@/lib/queries";
import type { CampaignType, Country, Payment, Platform, Status, StatusEvent, TaxType, Tier } from "@/lib/types";

// detail 패널 lazy-load — 기존 쿼리 래핑(데이터 계약 불변).
export async function getStatusHistory(collaborationId: string): Promise<StatusEvent[]> {
  return fetchStatusEvents(collaborationId);
}

export async function getPaymentFor(collaborationId: string): Promise<Payment | null> {
  return (await fetchPayment(collaborationId)) ?? null;
}

// Update a collaboration's status. The DB trigger (log_status_change)
// appends a row to collaboration_status_history automatically.
export async function updateStatus(id: string, status: Status) {
  const sb = createServerClient();
  if (!sb) return { ok: false, reason: "no-db" as const };
  const { error } = await sb.from("collaborations").update({ status }).eq("id", id);
  if (error) return { ok: false, reason: error.message };
  revalidateTag("collabs", "max");
  revalidatePath("/");
  revalidatePath("/board");
  revalidatePath(`/collaborations/${id}`);
  return { ok: true as const };
}

// Generalized inline edit. Whitelisted columns only; the status-history trigger
// still fires when `status` changes (same path as updateStatus).
export interface CollaborationPatch {
  status?: Status;
  manager?: string;
  notes?: string | null;
  contentFeeKrw?: number | null;
  lastContact?: string | null;
}

const PATCH_COLUMN: Record<keyof CollaborationPatch, string> = {
  status: "status",
  manager: "manager",
  notes: "notes",
  contentFeeKrw: "content_fee_krw",
  lastContact: "last_contact",
};

export async function updateCollaboration(id: string, patch: CollaborationPatch) {
  const sb = createServerClient();
  if (!sb) return { ok: false, reason: "no-db" as const };
  const dbPatch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    const col = PATCH_COLUMN[k as keyof CollaborationPatch];
    if (!col) continue; // 화이트리스트 외 무시
    dbPatch[col] = v === undefined ? null : v; // 빈값은 null로 명시 전송
  }
  if (Object.keys(dbPatch).length === 0) return { ok: false, reason: "empty" as const };
  const { error } = await sb.from("collaborations").update(dbPatch).eq("id", id);
  if (error) return { ok: false, reason: error.message };
  revalidateTag("collabs", "max");
  revalidatePath("/");
  revalidatePath("/board");
  revalidatePath(`/collaborations/${id}`);
  return { ok: true as const };
}

// 실제 지급 기록 — Executed fee를 시트 추정에서 실집행값으로 전환.
// 세금: 거주지별 원천징수율 분기(외국인 일괄 3.3% 금지). 기본율은 추정 — 세무사 확인.
// 내부 전용 — "use server" 파일은 async 함수만 export 가능(객체 export 금지).
const WITHHOLDING_RATE: Record<TaxType, number> = {
  "kr_resident_3.3": 3.3,
  nonresident_domestic: 22,
  nonresident_overseas: 0,
  none: 0,
};

export interface PaymentInput {
  grossKrw: number;
  taxType: TaxType;
  status: "pending" | "paid";
  paidAt?: string | null;
}

export async function upsertPayment(collaborationId: string, input: PaymentInput) {
  const sb = createServerClient();
  if (!sb) return { ok: false, reason: "no-db" as const };
  const rate = WITHHOLDING_RATE[input.taxType] ?? 0;
  const gross = Math.round(input.grossKrw || 0);
  if (gross <= 0) return { ok: false, reason: "gross must be > 0" };
  const tax = Math.round((gross * rate) / 100);
  const row = {
    collaboration_id: collaborationId,
    gross_krw: gross,
    currency: "KRW",
    tax_type: input.taxType,
    withholding_rate: rate,
    tax_krw: tax,
    net_krw: gross - tax,
    status: input.status,
    paid_at: input.status === "paid" ? input.paidAt || null : null,
  };
  const { data: existing } = await sb.from("payments").select("id").eq("collaboration_id", collaborationId).maybeSingle();
  const res = existing
    ? await sb.from("payments").update(row).eq("id", existing.id)
    : await sb.from("payments").insert(row);
  if (res.error) return { ok: false, reason: res.error.message };
  revalidateTag("collabs", "max");
  revalidatePath(`/collaborations/${collaborationId}`);
  revalidatePath("/");
  return { ok: true as const };
}

// ── 작업자 신규 입력 ──────────────────────────────────────────────────────
// 작업자가 시트 대신 앱에서 "새 인플루언서 발견 → 협업 시작"을 직접 한다.
// 핵심 안전장치: source_system='manual' + external_ref='manual:{uuid}' 태깅 →
// ETL 멱등 upsert(external_ref grain, frozen collab guard)가 이 행을 절대 건드리지 않음(D-16).
// creators는 (handle,platform) 재사용, campaign은 type별 재사용(ETL과 동일 규칙).

// followers 구간 → tier 자동 산출(작업자가 직접 안 골라도 되게). 입력 tier가 있으면 그걸 우선.
function tierFromFollowers(followers: number): Tier {
  if (followers >= 1_000_000) return "Mega";
  if (followers >= 500_000) return "Macro";
  if (followers >= 100_000) return "Mid";
  if (followers >= 10_000) return "Micro";
  return "Nano";
}

export interface WorkerEntryInput {
  // creator
  handle: string;
  name?: string;
  platform: Platform;
  country: Country;
  followers?: number;
  tier?: Tier;
  email?: string | null;
  // collaboration
  manager: string;
  campaignType: CampaignType;
  status?: Status;
  contentFeeKrw?: number | null;
  notes?: string | null;
}

export async function createWorkerEntry(input: WorkerEntryInput) {
  const sb = createServerClient();
  if (!sb) return { ok: false, reason: "no-db" as const };

  const handle = input.handle?.trim();
  const country = input.country?.trim();
  const manager = input.manager?.trim() || "unknown";
  if (!handle) return { ok: false, reason: "handle is required" as const };
  if (!input.platform) return { ok: false, reason: "platform is required" as const };
  if (!country) return { ok: false, reason: "country is required" as const };

  const followers = Math.max(0, Math.round(input.followers ?? 0));
  const tier = input.tier ?? tierFromFollowers(followers);

  // 1) creator — (handle,platform) 재사용, 없으면 manual 태깅으로 신규.
  let creatorId: string;
  const { data: existingCreator, error: findErr } = await sb
    .from("creators")
    .select("id")
    .eq("handle", handle)
    .eq("platform", input.platform)
    .maybeSingle();
  if (findErr) return { ok: false, reason: findErr.message };
  if (existingCreator) {
    creatorId = existingCreator.id as string;
  } else {
    const { data: created, error } = await sb
      .from("creators")
      .insert({
        handle,
        name: input.name?.trim() || null,
        platform: input.platform,
        country,
        followers,
        tier,
        email: input.email?.trim() || null,
        manager,
        source_system: "manual",
        in_legacy_list: false,
      })
      .select("id")
      .single();
    if (error) return { ok: false, reason: error.message };
    creatorId = created.id as string;
  }

  // 2) campaign — type별 재사용(ETL: "Seeding {type}", brand zipiel), 없으면 생성.
  const campaignType: CampaignType = input.campaignType || "Gifted";
  let campaignId: string | undefined;
  const { data: camp } = await sb.from("campaigns").select("id").eq("type", campaignType).limit(1).maybeSingle();
  if (camp) {
    campaignId = camp.id as string;
  } else {
    const { data: c, error } = await sb
      .from("campaigns")
      .insert({ name: `Seeding ${campaignType}`, type: campaignType, brand: "zipiel" })
      .select("id")
      .single();
    if (error) return { ok: false, reason: error.message };
    campaignId = c.id as string;
  }

  // 3) collaboration — manual 태깅. listed_date=오늘. status 기본 Listing.
  const today = new Date().toISOString().slice(0, 10);
  const externalRef = `manual:${globalThis.crypto.randomUUID()}`;
  const { data: collab, error } = await sb
    .from("collaborations")
    .insert({
      creator_id: creatorId,
      campaign_id: campaignId,
      status: input.status ?? "Listing",
      manager,
      content_fee_krw: input.contentFeeKrw ?? null,
      notes: input.notes?.trim() || null,
      listed_date: today,
      source_system: "manual",
      external_ref: externalRef,
    })
    .select("id")
    .single();
  if (error) return { ok: false, reason: error.message };

  revalidateTag("collabs", "max");
  revalidatePath("/");
  revalidatePath("/board");
  return { ok: true as const, id: collab.id as string };
}
