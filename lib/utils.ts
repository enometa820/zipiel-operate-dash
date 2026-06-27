export function formatKrw(n?: number): string {
  if (n == null) return "—";
  return "₩" + n.toLocaleString("en-US");
}

export function formatCompact(n: number): string {
  return Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function formatDate(iso?: string): string {
  if (!iso) return "—";
  return iso.slice(0, 10); // 2026-04-08
}

export function daysAgo(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  if (isNaN(d)) return "—"; // 잘못된 날짜는 'NaN d ago' 대신 '—'
  const diff = Math.floor((Date.now() - d) / 86_400_000);
  if (diff <= 0) return "today";
  if (diff === 1) return "1d ago";
  return `${diff}d ago`;
}
