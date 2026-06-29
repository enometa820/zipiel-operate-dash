// 작업 그리드 필터 — 순수 함수(React 무의존). 전체가 이미 클라이언트에 로드돼 있어
// 클라이언트 필터로 충분. Grid/Kanban/Table이 같은 결과를 공유한다.
import { STATUS_PHASE, type Country, type Status } from "./types";
import type { CollaborationView } from "./data";
import { isStuck } from "./stuck";

export type DateDim = "listed" | "lastContact" | "scheduled";

export interface GridFilters {
  statuses: Status[]; // 비면 전체
  countries: Country[];
  managers: string[];
  type: string; // "all" | Gifted | Paid | Affiliate
  q: string;
  dateDim: DateDim;
  dateFrom: string; // YYYY-MM-DD or ""
  dateTo: string;
  hideSourcing: boolean;
  stuckOnly: boolean; // active 중 정체(미소통 14일+)만
}

export const EMPTY_FILTERS: GridFilters = {
  statuses: [],
  countries: [],
  managers: [],
  type: "all",
  q: "",
  dateDim: "listed",
  dateFrom: "",
  dateTo: "",
  hideSourcing: false,
  stuckOnly: false,
};

function dateField(v: CollaborationView, dim: DateDim): string | undefined {
  if (dim === "listed") return v.listedDate;
  if (dim === "lastContact") return v.lastContact;
  return v.scheduledPostDate;
}

export function applyFilters(views: CollaborationView[], f: GridFilters): CollaborationView[] {
  const q = f.q.trim().toLowerCase();
  const statusSet = new Set(f.statuses);
  const countrySet = new Set(f.countries);
  const managerSet = new Set(f.managers);
  const hasDate = Boolean(f.dateFrom || f.dateTo);
  return views.filter((v) => {
    if (f.hideSourcing && STATUS_PHASE[v.status] === "Sourcing") return false;
    if (f.stuckOnly && !isStuck(v.status, v.lastContact)) return false;
    if (statusSet.size && !statusSet.has(v.status)) return false;
    if (countrySet.size && !countrySet.has(v.creator.country)) return false;
    if (managerSet.size && !managerSet.has(v.manager)) return false;
    if (f.type !== "all" && v.campaign.type !== f.type) return false;
    if (q && !v.creator.handle.toLowerCase().includes(q) && !(v.creator.name ?? "").toLowerCase().includes(q)) return false;
    if (hasDate) {
      const d = dateField(v, f.dateDim);
      if (!d) return false; // 날짜 없는 행은 범위 필터에서 제외
      if (f.dateFrom && d < f.dateFrom) return false;
      if (f.dateTo && d > f.dateTo) return false;
    }
    return true;
  });
}

export function activeFilterCount(f: GridFilters): number {
  return (
    (f.statuses.length ? 1 : 0) +
    (f.countries.length ? 1 : 0) +
    (f.managers.length ? 1 : 0) +
    (f.type !== "all" ? 1 : 0) +
    (f.q ? 1 : 0) +
    (f.dateFrom || f.dateTo ? 1 : 0) +
    (f.hideSourcing ? 1 : 0) +
    (f.stuckOnly ? 1 : 0)
  );
}
