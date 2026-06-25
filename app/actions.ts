"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase";
import type { Status } from "@/lib/types";

// Update a collaboration's status. The DB trigger (log_status_change)
// appends a row to collaboration_status_history automatically.
export async function updateStatus(id: string, status: Status) {
  const sb = createServerClient();
  if (!sb) return { ok: false, reason: "no-db" as const };
  const { error } = await sb.from("collaborations").update({ status }).eq("id", id);
  if (error) return { ok: false, reason: error.message };
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
  revalidatePath("/");
  revalidatePath("/board");
  revalidatePath(`/collaborations/${id}`);
  return { ok: true as const };
}
