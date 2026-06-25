"use client";

import { useFormStatus } from "react-dom";

// 로그인 제출 중 로딩 피드백 — 서버액션 처리(쿠키·리다이렉트) 동안 멈춘 듯 보이지 않게.
export function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full mt-4 px-3 py-2 rounded-lg bg-[var(--accent)] text-white font-medium hover:opacity-90 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
    >
      {pending && <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}
