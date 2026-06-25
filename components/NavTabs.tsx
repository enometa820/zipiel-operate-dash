"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Pipeline" },
  { href: "/status", label: "개발 현황" },
];

export function NavTabs() {
  const path = usePathname();
  return (
    <nav className="inline-flex rounded-lg border border-[var(--border-strong)] overflow-hidden shrink-0">
      {TABS.map((t) => {
        const active = path === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              active
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--panel)] text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--panel-2)]"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
