// 데이터 로딩 중 폴백 — 로그인 직후 Overview/Board가 14k행을 서버 조회하는 동안 표시.
export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <span className="h-7 w-7 rounded-full border-2 border-[var(--border-strong)] border-t-[var(--accent)] animate-spin" />
      <p className="text-sm text-[var(--muted)]">Loading pipeline…</p>
    </div>
  );
}
