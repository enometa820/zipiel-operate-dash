"use client";

import { ChevronDown } from "lucide-react";
import { STATUS_STYLE, statusLabel } from "@/lib/status-style";
import { STATUSES, STATUS_KO, type Status } from "@/lib/types";

// 읽기 전용 상태 pill — 시트 정본 색, 한/영 병기. detail 패널 헤더·비편집 맥락.
export function StatusPill({ status }: { status: Status }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className="inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: s.bg, color: s.fg }}
      title={statusLabel(status)}
    >
      {statusLabel(status)}
    </span>
  );
}

// 인라인 편집 pill — 시트처럼 색 채움 드롭다운(핵심 동작 유지). 닫힌 셀은 병기 truncate(시트 동일).
// caret(▾)로 편집 가능 표식 — 시트 status 셀과 동일.
export function StatusSelectCell({ status, onChange }: { status: Status; onChange: (s: Status) => void }) {
  const s = STATUS_STYLE[status];
  return (
    <span className="relative inline-flex w-full max-w-full items-center rounded-full" style={{ background: s.bg }}>
      <select
        value={status}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onChange(e.target.value as Status)}
        title={statusLabel(status)}
        aria-label={`Status: ${statusLabel(status)}`}
        className="w-full max-w-full cursor-pointer truncate appearance-none rounded-full bg-transparent py-0.5 pl-2 pr-5 text-[11px] font-semibold outline-none"
        style={{ color: s.fg }}
      >
        {STATUSES.map((opt) => (
          <option key={opt} value={opt} style={{ color: "var(--text)", background: "var(--panel)" }}>
            {STATUS_KO[opt]} ({opt})
          </option>
        ))}
      </select>
      <ChevronDown size={12} className="pointer-events-none absolute right-1.5 shrink-0" style={{ color: s.fg, opacity: 0.65 }} />
    </span>
  );
}
