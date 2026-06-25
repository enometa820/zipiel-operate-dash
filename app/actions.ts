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
  revalidatePath(`/collaborations/${id}`);
  return { ok: true as const };
}
