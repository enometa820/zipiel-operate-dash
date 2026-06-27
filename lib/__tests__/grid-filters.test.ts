import { describe, it, expect } from "vitest";
import { applyFilters, activeFilterCount, EMPTY_FILTERS, type GridFilters } from "../grid-filters";
import type { CollaborationView } from "../data";
import type { Status, Country } from "../types";

// 최소 CollaborationView 팩토리 — 필터 대상 필드만 채운다.
function view(over: {
  id: string;
  status?: Status;
  country?: Country;
  manager?: string;
  type?: "Gifted" | "Paid" | "Affiliate";
  handle?: string;
  name?: string;
  listedDate?: string;
}): CollaborationView {
  return {
    id: over.id,
    creatorId: "c-" + over.id,
    campaignId: "cmp-1",
    status: over.status ?? "Negotiating",
    manager: over.manager ?? "Sol",
    listedDate: over.listedDate,
    creator: {
      id: "c-" + over.id,
      handle: over.handle ?? "creator" + over.id,
      name: over.name ?? "Name " + over.id,
      platform: "instagram",
      country: over.country ?? "KR",
      followers: 1000,
      tier: "Nano",
      manager: over.manager ?? "Sol",
    },
    campaign: { id: "cmp-1", name: "C", type: over.type ?? "Gifted", brand: "zipiel" },
  } as CollaborationView;
}

const SAMPLE: CollaborationView[] = [
  view({ id: "1", status: "Listing", country: "KR", manager: "Sol", type: "Gifted", handle: "alpha", listedDate: "2026-06-01" }),
  view({ id: "2", status: "Negotiating", country: "JP", manager: "Anna", type: "Paid", handle: "beta", listedDate: "2026-06-15" }),
  view({ id: "3", status: "Completed", country: "TW", manager: "Sol", type: "Paid", handle: "gamma", name: "Special", listedDate: "2026-06-20" }),
  view({ id: "4", status: "Contact Completed", country: "KR", manager: "Nhi", type: "Affiliate", handle: "delta" }),
];

describe("applyFilters", () => {
  it("빈 필터는 전체 반환", () => {
    expect(applyFilters(SAMPLE, EMPTY_FILTERS)).toHaveLength(4);
  });

  it("status 집합 필터", () => {
    const f: GridFilters = { ...EMPTY_FILTERS, statuses: ["Completed", "Negotiating"] };
    expect(applyFilters(SAMPLE, f).map((v) => v.id).sort()).toEqual(["2", "3"]);
  });

  it("country 집합 필터", () => {
    const f: GridFilters = { ...EMPTY_FILTERS, countries: ["KR"] };
    expect(applyFilters(SAMPLE, f).map((v) => v.id).sort()).toEqual(["1", "4"]);
  });

  it("manager 집합 필터", () => {
    const f: GridFilters = { ...EMPTY_FILTERS, managers: ["Sol"] };
    expect(applyFilters(SAMPLE, f).map((v) => v.id).sort()).toEqual(["1", "3"]);
  });

  it("campaign type 필터", () => {
    const f: GridFilters = { ...EMPTY_FILTERS, type: "Paid" };
    expect(applyFilters(SAMPLE, f).map((v) => v.id).sort()).toEqual(["2", "3"]);
  });

  it("q 텍스트는 handle·name 소문자 부분일치", () => {
    expect(applyFilters(SAMPLE, { ...EMPTY_FILTERS, q: "BET" }).map((v) => v.id)).toEqual(["2"]);
    expect(applyFilters(SAMPLE, { ...EMPTY_FILTERS, q: "special" }).map((v) => v.id)).toEqual(["3"]);
  });

  it("hideSourcing은 Sourcing 페이즈(Listing·Contact Completed) 제외", () => {
    const ids = applyFilters(SAMPLE, { ...EMPTY_FILTERS, hideSourcing: true }).map((v) => v.id).sort();
    expect(ids).toEqual(["2", "3"]);
  });

  it("날짜 범위 — 범위 밖·날짜 없는 행 제외", () => {
    const f: GridFilters = { ...EMPTY_FILTERS, dateDim: "listed", dateFrom: "2026-06-10", dateTo: "2026-06-18" };
    expect(applyFilters(SAMPLE, f).map((v) => v.id)).toEqual(["2"]); // id4=날짜없음 제외, id1·3=범위밖
  });

  it("필터 조합(AND)", () => {
    const f: GridFilters = { ...EMPTY_FILTERS, managers: ["Sol"], type: "Paid" };
    expect(applyFilters(SAMPLE, f).map((v) => v.id)).toEqual(["3"]);
  });
});

describe("activeFilterCount", () => {
  it("빈 필터는 0", () => expect(activeFilterCount(EMPTY_FILTERS)).toBe(0));
  it("차원별 1씩 합산", () => {
    const f: GridFilters = { ...EMPTY_FILTERS, statuses: ["Drop"], q: "x", type: "Paid", hideSourcing: true };
    expect(activeFilterCount(f)).toBe(4);
  });
});
