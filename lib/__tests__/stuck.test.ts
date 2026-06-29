import { describe, it, expect } from "vitest";
import { isStuck, daysSince, STUCK_DAYS } from "../stuck";

const today = new Date().toISOString().slice(0, 10);

describe("isStuck — Overview·board 공유 정체 정의", () => {
  it("Drop은 정체 아님(파이프라인 이탈)", () => {
    expect(isStuck("Drop", null)).toBe(false);
    expect(isStuck("Drop", "2020-01-01")).toBe(false);
  });

  it("Sourcing 단계(발굴 풀)는 정체 아님", () => {
    expect(isStuck("Listing", null)).toBe(false);
    expect(isStuck("Contact Completed", "2020-01-01")).toBe(false);
  });

  it("active + 소통 미기록 → 정체", () => {
    expect(isStuck("Negotiating", null)).toBe(true);
    expect(isStuck("Negotiating", undefined)).toBe(true);
  });

  it("active + 14일+ 무소통 → 정체", () => {
    expect(isStuck("Negotiating", "2020-01-01")).toBe(true);
  });

  it("active + 최근 소통 → 정체 아님", () => {
    expect(isStuck("Negotiating", today)).toBe(false);
  });

  it("잘못된 날짜는 미상(null) 취급 → 정체", () => {
    expect(isStuck("Negotiating", "2026-02-30")).toBe(true);
  });
});

describe("daysSince", () => {
  it("미상·잘못된 날짜는 null", () => {
    expect(daysSince(null)).toBeNull();
    expect(daysSince(undefined)).toBeNull();
    expect(daysSince("not-a-date")).toBeNull();
  });

  it("오늘은 0일", () => {
    expect(daysSince(today)).toBe(0);
  });

  it("STUCK_DAYS는 14", () => {
    expect(STUCK_DAYS).toBe(14);
  });
});
