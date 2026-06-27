"use client";

import { useState, useTransition } from "react";
import { updateStatus } from "@/app/actions";
import { PHASE_META, STATUS_PHASE, STATUSES, type Status } from "@/lib/types";
import { statusLabel } from "@/lib/status-style";

export function StatusEditor({ id, status }: { id: string; status: Status }) {
  const [cur, setCur] = useState<Status>(status);
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const accent = PHASE_META[STATUS_PHASE[cur]].accent;

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label="Collaboration status"
        value={cur}
        disabled={pending}
        onChange={(e) => {
          const s = e.target.value as Status;
          const prev = cur;
          setCur(s);
          setErr("");
          start(async () => {
            const res = await updateStatus(id, s);
            if (!res.ok) {
              setCur(prev);
              setErr(res.reason ?? "Update failed — reverted");
            }
          });
        }}
        className="text-sm font-semibold rounded-lg px-3 py-1.5 bg-transparent outline-none cursor-pointer disabled:opacity-50"
        style={{ color: accent, border: `1px solid ${accent}` }}
        title={statusLabel(cur)}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s} className="text-[var(--text)]">
            {statusLabel(s)}
          </option>
        ))}
      </select>
      {pending && <span className="text-xs text-[var(--muted)]">saving…</span>}
      {err && <span className="text-xs text-[var(--phase-dropped)]">{err}</span>}
    </div>
  );
}
