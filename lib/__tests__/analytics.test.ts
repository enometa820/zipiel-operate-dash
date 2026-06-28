import { describe, it, expect } from "vitest";
import { aggregate, normalizeProduct, bucketKey, type AnalyticsRecord } from "../analytics";

function rec(over: Partial<AnalyticsRecord>): AnalyticsRecord {
  return { category: "Serum", postedAt: "2026-05-10", scheduledPostDate: "2026-05-01", country: "KR", tier: "Nano", views: 100, likes: 5, comments: 3, reposts: 1, saves: 1, shares: 0, ...over };
}

describe("normalizeProduct", () => {
  it("단일 제품(한/영)을 해당 열로", () => {
    expect(normalizeProduct("Serum")).toBe("Serum");
    expect(normalizeProduct("크림")).toBe("Cream");
    expect(normalizeProduct("Clay")).toBe("Clay");
  });
  it("'all'은 All, 빈 값은 Unknown", () => {
    expect(normalizeProduct("all")).toBe("All");
    expect(normalizeProduct("전체")).toBe("All");
    expect(normalizeProduct("")).toBe("Unknown");
    expect(normalizeProduct(null)).toBe("Unknown");
  });
  it("복수 제품(세미콜론·콤마·Mask)은 Mixed", () => {
    expect(normalizeProduct("Cream; Clay")).toBe("Mixed");
    expect(normalizeProduct("Cream, Clay")).toBe("Mixed");
    expect(normalizeProduct("Cream; Mask")).toBe("Mixed"); // Mask 포함 복수
    expect(normalizeProduct("세럼, 크림, 모델링클레이")).toBe("Mixed");
  });
  it("같은 제품 중복은 단일로", () => {
    expect(normalizeProduct("Serum; Serum")).toBe("Serum");
  });
});

describe("bucketKey", () => {
  it("month=YYYY-MM, day=날짜", () => {
    expect(bucketKey("2026-05-10", "month")).toBe("2026-05");
    expect(bucketKey("2026-05-10", "day")).toBe("2026-05-10");
  });
  it("week=그 주 월요일(ISO)", () => {
    expect(bucketKey("2026-05-10", "week")).toBe("2026-05-04"); // 2026-05-10=일 → 월요일 05-04
    expect(bucketKey("2026-05-04", "week")).toBe("2026-05-04"); // 월요일 자기 자신
    expect(bucketKey("2026-05-11", "week")).toBe("2026-05-11"); // 월요일
  });
});

describe("aggregate", () => {
  it("매트릭스 총합 = posted 있는 레코드 수", () => {
    const recs = [rec({ postedAt: "2026-05-01" }), rec({ postedAt: "2026-05-02" }), rec({ postedAt: null })];
    const a = aggregate(recs, "month");
    expect(a.matrix.grandTotal).toBe(2); // posted null은 제외
  });

  it("달성률 = 예정 중 발행 비율, 분모 0이면 null", () => {
    const recs = [
      rec({ scheduledPostDate: "2026-05-01", postedAt: "2026-05-02" }),
      rec({ scheduledPostDate: "2026-05-01", postedAt: null }), // 예정만, 미발행
    ];
    const a = aggregate(recs, "month");
    expect(a.achievement.scheduled).toBe(2);
    expect(a.achievement.posted).toBe(1);
    expect(a.achievement.rate).toBe(50);

    const none = aggregate([rec({ scheduledPostDate: null })], "month");
    expect(none.achievement.rate).toBeNull(); // 분모 0 = null(날조 금지)
  });

  it("인게이지먼트는 views>0만 분모, views 0/null 제외", () => {
    const recs = [
      rec({ views: 100, likes: 10, comments: 0, reposts: 0, saves: 0, shares: 0 }), // 10%
      rec({ views: 0 }), // 제외
      rec({ views: null }), // 제외
    ];
    const a = aggregate(recs, "month");
    expect(a.engagement.collected).toBe(1);
    expect(a.engagement.total).toBe(3);
    expect(a.engagement.avgPct).toBe(10);
  });

  it("복합 제품은 Mixed 열로 집계(합 불일치 없음)", () => {
    const recs = [rec({ category: "Cream; Clay", postedAt: "2026-05-01" }), rec({ category: "Serum", postedAt: "2026-05-01" })];
    const a = aggregate(recs, "month");
    expect(a.matrix.productTotals["Mixed"]).toBe(1);
    expect(a.matrix.productTotals["Serum"]).toBe(1);
    const sumCols = a.matrix.products.reduce((s, p) => s + (a.matrix.productTotals[p] ?? 0), 0);
    expect(sumCols).toBe(a.matrix.grandTotal); // 열 합 = 총합(복합 중복 카운트 없음)
  });

  it("country 필터는 매트릭스·요약에만, byCountry는 전체", () => {
    const recs = [
      rec({ country: "KR", postedAt: "2026-05-01" }),
      rec({ country: "JP", postedAt: "2026-05-01" }),
    ];
    const all = aggregate(recs, "month", "all");
    expect(all.matrix.grandTotal).toBe(2);
    const kr = aggregate(recs, "month", "KR");
    expect(kr.matrix.grandTotal).toBe(1); // 필터 적용
    expect(kr.countryProduct.countries.length).toBe(2); // 비교 패널은 전체
  });

  it("달성률 byBucket이 grain별로 분해된다(grain 토글 반응)", () => {
    const recs = [
      rec({ scheduledPostDate: "2026-04-10", postedAt: "2026-04-11" }),
      rec({ scheduledPostDate: "2026-05-10", postedAt: null }),
      rec({ scheduledPostDate: "2026-05-20", postedAt: "2026-05-21" }),
    ];
    const mo = aggregate(recs, "month");
    const apr = mo.achievement.byBucket.find((b) => b.bucket === "2026-04");
    const may = mo.achievement.byBucket.find((b) => b.bucket === "2026-05");
    expect(apr?.rate).toBe(100); // 1/1
    expect(may?.rate).toBe(50); // 1/2
    // grain을 day로 바꾸면 버킷이 더 잘게 — 같은 입력이 다른 분해
    const day = aggregate(recs, "day");
    expect(day.achievement.byBucket.length).toBe(3);
  });

  it("빈 입력에서 깨지지 않음(NaN/Infinity 0)", () => {
    const a = aggregate([], "day");
    expect(a.matrix.grandTotal).toBe(0);
    expect(a.achievement.rate).toBeNull();
    expect(a.engagement.avgPct).toBeNull();
    expect(a.summary.activeCountries).toBe(0);
  });
});
