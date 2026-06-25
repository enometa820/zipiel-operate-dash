"use client";

import { useState, useTransition } from "react";
import { updateStatus } from "@/app/actions";
import { PHASE_META, STATUS_PHASE, STATUS_KO, STATUSES, type Status } from "@/lib/types";

export function StatusEditor({ id, status }: { id: string; status: Status }) {
  const [cur, setCur] = useState<Status>(status);
  const [pending, start] = useTransition();
  const accent = PHASE_META[STATUS_PHASE[cur]].accent;

  return (
    <div className="flex items-center gap-2">
      <select
        value={cur}
        disabled={pending}
        onChange={(e) => {
          const s = e.target.value as Status;
          const prev = cur;
          setCur(s);
          start(async () => {
            const res = await updateStatus(id, s);
            if (!res.ok) setCur(prev);
          });
        }}
        className="text-sm font-semibold rounded-lg px-3 py-1.5 bg-transparent outline-none cursor-pointer disabled:opacity-50"
        style={{ color: accent, border: `1px solid ${accent}` }}
        title={STATUS_KO[cur]}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s} className="text-[var(--text)]">
            {s} · {STATUS_KO[s]}
          </option>
        ))}
      </select>
      {pending && <span className="text-xs text-[var(--muted)]">saving…</span>}
    </div>
  );
}
