"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createServerClient } from "@/lib/supabase";
import type { Status, TaxType } from "@/lib/types";

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
export const WITHHOLDING_RATE: Record<TaxType, number> = {
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
