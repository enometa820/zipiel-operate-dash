"use client";

// Route error boundary — force-dynamic 페이지(Overview·Board·Deal)가 DB 다운·타임아웃으로
// throw하면 흰 화면 대신 사용자 친화 메시지 + 재시도. 운영언어=영어.
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="text-3xl">⚠️</div>
      <div>
        <h1 className="text-lg font-bold">Couldn’t load this page</h1>
        <p className="mt-1 max-w-md text-sm text-[var(--muted)]">
          The data service may be temporarily unavailable. Your data is safe — please retry in a moment.
        </p>
      </div>
      <button
        onClick={reset}
        className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        Retry
      </button>
    </div>
  );
}
