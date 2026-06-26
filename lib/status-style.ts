// 상태 색 팔레트 — effie 실제 시트 드롭다운(user/image.png) 정본 일치.
// per-status 고정 색(일반 페이즈 파스텔로 덮어쓰지 않음 — 브랜드·도메인 우선).
// inline style로 적용해 Tailwind purge 안전(동적 클래스 조합 금지).
import { STATUS_KO, type Status } from "./types";

export interface StatusStyle {
  bg: string;
  fg: string;
  filled?: boolean; // 채움(진한 배경+흰 글씨) — On Hold·Completed
}

// 시트 색계열: 협의군=로즈 · Contract=앰버 · 배송군=초록 · Guideline=파랑 ·
// Production=청록 · Uploaded=보라 · On Hold=마룬채움 · Completed=다크채움 ·
// Listing/Seeding=중립 · Drop=연레드.
export const STATUS_STYLE: Record<Status, StatusStyle> = {
  Listing: { bg: "#eef2f6", fg: "#5b6472" },
  "Contact Completed": { bg: "#ffe4e6", fg: "#be123c" },
  Negotiating: { bg: "#ffe4e6", fg: "#be123c" },
  "Rate Inquiry": { bg: "#ffe4e6", fg: "#be123c" },
  "Confirmed to Proceed": { bg: "#ffdfe2", fg: "#9f1239" },
  Contract: { bg: "#fef3c7", fg: "#b45309" },
  "Request Shipping Information": { bg: "#dcfce7", fg: "#15803d" },
  Shipping: { bg: "#d1fadf", fg: "#047857" },
  "Guideline Sent": { bg: "#dbeafe", fg: "#1d4ed8" },
  "Content in Production": { bg: "#cffafe", fg: "#0e7490" },
  "Content Uploaded": { bg: "#ede9fe", fg: "#6d28d9" },
  "On Hold": { bg: "#9f1239", fg: "#ffffff", filled: true },
  "Simple Seeding/PR": { bg: "#f1f5f9", fg: "#64748b" },
  Completed: { bg: "#334155", fg: "#ffffff", filled: true },
  Drop: { bg: "#fee2e2", fg: "#b91c1c" },
};

// 한/영 병기 라벨 — 시트 형식 "한글 (English)" (사용자 지시: 둘 다 노출).
export function statusLabel(s: Status): string {
  return `${STATUS_KO[s]} (${s})`;
}
