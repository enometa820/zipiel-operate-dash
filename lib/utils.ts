import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatKrw(n?: number): string {
  if (n == null) return "—";
  return "₩" + n.toLocaleString("en-US");
}

export function formatCompact(n: number): string {
  return Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function daysAgo(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  const diff = Math.floor((Date.now() - d) / 86_400_000);
  if (diff <= 0) return "today";
  if (diff === 1) return "1d ago";
  return `${diff}d ago`;
}
