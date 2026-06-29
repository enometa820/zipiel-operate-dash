"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { createWorkerEntry, type WorkerEntryInput } from "@/app/actions";
import {
  type CampaignType,
  type Country,
  type Platform,
  type Status,
  STATUSES,
  STATUS_KO,
} from "@/lib/types";

const PLATFORMS: Platform[] = ["instagram", "tiktok", "youtube", "x", "threads", "xiaohongshu", "douyin"];
const COUNTRIES: Country[] = ["KR", "JP", "TW", "SG", "MY", "HK", "CN", "US"];
const CAMPAIGN_TYPES: CampaignType[] = ["Gifted", "Paid", "Affiliate"];

// 작업자가 시트 대신 앱에서 새 협업을 시작하는 입력 폼.
// 필수: handle·platform·country·manager. 나머지는 나중에 board 인라인 편집으로 채운다.
export function NewEntryDialog({
  managers,
  onClose,
  onCreated,
}: {
  managers: string[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [handle, setHandle] = useState("");
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [country, setCountry] = useState<Country>("KR");
  const [followers, setFollowers] = useState("");
  const [manager, setManager] = useState(managers[0] ?? "");
  const [campaignType, setCampaignType] = useState<CampaignType>("Gifted");
  const [status, setStatus] = useState<Status>("Listing");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = handle.trim() && manager.trim() && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    const input: WorkerEntryInput = {
      handle: handle.trim(),
      name: name.trim() || undefined,
      platform,
      country,
      followers: followers ? Number(followers.replace(/[^0-9]/g, "")) : 0,
      manager: manager.trim(),
      campaignType,
      status,
      notes: notes.trim() || null,
    };
    const res = await createWorkerEntry(input);
    setBusy(false);
    if (!res.ok) {
      setError(res.reason ?? "Failed to create");
      return;
    }
    onCreated();
  }

  const field = "w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1.5 text-sm";
  const label = "mb-1 block text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="New collaboration entry"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--border-strong)] bg-[var(--bg)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold">New entry</h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">Add a creator & start a collaboration — fill the rest inline later.</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-[var(--muted)] hover:bg-[var(--panel-2)]" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={label} htmlFor="ne-handle">Handle / @ *</label>
            <input id="ne-handle" className={field} value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@username" autoFocus />
          </div>
          <div className="col-span-2">
            <label className={label} htmlFor="ne-name">Display name</label>
            <input id="ne-name" className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="optional" />
          </div>
          <div>
            <label className={label} htmlFor="ne-platform">Platform *</label>
            <select id="ne-platform" className={field} value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>
              {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="ne-country">Country *</label>
            <select id="ne-country" className={field} value={country} onChange={(e) => setCountry(e.target.value as Country)}>
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="ne-followers">Followers</label>
            <input id="ne-followers" className={field} value={followers} onChange={(e) => setFollowers(e.target.value)} inputMode="numeric" placeholder="0" />
          </div>
          <div>
            <label className={label} htmlFor="ne-manager">Manager *</label>
            <input id="ne-manager" className={field} value={manager} onChange={(e) => setManager(e.target.value)} list="ne-managers" placeholder="owner" />
            <datalist id="ne-managers">{managers.map((m) => <option key={m} value={m} />)}</datalist>
          </div>
          <div>
            <label className={label} htmlFor="ne-type">Type</label>
            <select id="ne-type" className={field} value={campaignType} onChange={(e) => setCampaignType(e.target.value as CampaignType)}>
              {CAMPAIGN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="ne-status">Status</label>
            <select id="ne-status" className={field} value={status} onChange={(e) => setStatus(e.target.value as Status)}>
              {STATUSES.map((s) => <option key={s} value={s}>{s} · {STATUS_KO[s]}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className={label} htmlFor="ne-notes">Notes</label>
            <textarea id="ne-notes" className={field} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="optional" />
          </div>
        </div>

        {error && <p className="mt-3 text-xs text-[var(--phase-dropped)]" role="alert">{error}</p>}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] hover:bg-[var(--panel-2)]">Cancel</button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="rounded-lg bg-[var(--accent)] px-3.5 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Adding…" : "Add entry"}
          </button>
        </div>
      </div>
    </div>
  );
}
