import { describe, it, expect } from "vitest";
import { mergePrefs, DEFAULT_PREFS, GRID_COLUMNS } from "../grid-prefs";

const ALL_IDS = GRID_COLUMNS.map((c) => c.id);

describe("mergePrefs", () => {
  it("null이면 기본값", () => {
    expect(mergePrefs(null)).toEqual(DEFAULT_PREFS);
  });

  it("저장 안 된 컬럼 가시성은 기본값으로 백필", () => {
    const merged = mergePrefs({ columnVisibility: { status: false } });
    expect(merged.columnVisibility.status).toBe(false); // 저장값 유지
    expect(merged.columnVisibility.creator).toBe(true); // 백필
    expect(Object.keys(merged.columnVisibility).sort()).toEqual([...ALL_IDS].sort());
  });

  it("stale 컬럼 id는 순서에서 제거", () => {
    const merged = mergePrefs({ columnOrder: ["creator", "ghost_col", "status"] });
    expect(merged.columnOrder).not.toContain("ghost_col");
    expect(merged.columnOrder).toContain("creator");
  });

  it("누락된 컬럼 id는 순서 끝에 보강", () => {
    const merged = mergePrefs({ columnOrder: ["creator", "status"] });
    expect([...merged.columnOrder].sort()).toEqual([...ALL_IDS].sort());
    expect(merged.columnOrder.slice(0, 2)).toEqual(["creator", "status"]); // 저장 순서 보존(앞)
  });

  it("density·groupBy 저장값 유지, 누락은 기본값", () => {
    expect(mergePrefs({ density: "condensed" }).density).toBe("condensed");
    expect(mergePrefs({}).groupBy).toBe(DEFAULT_PREFS.groupBy);
  });
});
