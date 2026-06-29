import { STATUS_PHASE, type Status } from "./types";

// 정체 판정 — Overview(서버 집계)와 board(클라이언트 필터)가 같은 정의를 공유한다.
export const STUCK_DAYS = 14;

// 마지막 소통 이후 경과일. 미상·잘못된 날짜(예: 2026-04-31)는 null.
export function daysSince(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

// active(Drop·Sourcing 제외) 중 소통이 끊긴(미기록 또는 14일+) 협업.
// 담당자가 손을 뗀 뒤 가장 먼저 점검해야 할 대상.
export function isStuck(status: Status, lastContact?: string | null): boolean {
  if (status === "Drop") return false;
  if (STATUS_PHASE[status] === "Sourcing") return false;
  const d = daysSince(lastContact);
  return d === null || d >= STUCK_DAYS;
}
