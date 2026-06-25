"use client";

import { useState } from "react";

// 인라인 편집 셀. 낙관 갱신·persist는 상위(DashboardClient)가 onEdit으로 처리.
// select = 즉시 commit, text/number/date = blur·Enter commit.

export function SelectCell({
  value,
  options,
  onCommit,
  accent,
}: {
  value: string;
  options: { value: string; label: string; title?: string }[];
  onCommit: (v: string) => void;
  accent?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onCommit(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      className="w-full bg-transparent text-xs font-medium rounded px-1 py-0.5 outline-none cursor-pointer hover:bg-[var(--panel-2)] truncate"
      style={accent ? { color: accent } : undefined}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} title={o.title} style={{ color: "var(--text)" }}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function TextCell({
  value,
  onCommit,
  placeholder,
  type = "text",
}: {
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  type?: "text" | "number" | "date";
}) {
  const [v, setV] = useState(value);
  // 외부 값(낙관 갱신/재fetch) 변경 시 렌더 중 동기화 — effect 없이(React 권장 패턴)
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setV(value);
  }

  return (
    <input
      type={type}
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onBlur={() => {
        if (v !== value) onCommit(v);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setV(value);
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="w-full bg-transparent text-xs rounded px-1 py-0.5 outline-none focus:bg-[var(--panel)] focus:ring-1 focus:ring-[var(--accent)] tabular-nums"
    />
  );
}
