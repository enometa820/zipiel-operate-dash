import { describe, it, expect } from "vitest";
import { aggregateLogistics, statusLabel, GLOBAL_SID, DOMESTIC_SID, type ShipmentRecord } from "../logistics";

function sh(over: Partial<ShipmentRecord>): ShipmentRecord {
  return { countryCode: "CN", brandTag: null, carrier: "EMS", feeKrw: 1000, deliveryStatus: "출고", sourceSheetId: GLOBAL_SID, matchStatus: "unmatched", ...over };
}

describe("statusLabel", () => {
  it("한글 상태를 영어로, 미인식은 원값, 빈값은 Unknown", () => {
    expect(statusLabel("출고")).toBe("Shipped");
    expect(statusLabel("취소")).toBe("Cancelled");
    expect(statusLabel("미지정상태")).toBe("미지정상태");
    expect(statusLabel(null)).toBe("Unknown");
    expect(statusLabel("")).toBe("Unknown");
  });
});

describe("aggregateLogistics", () => {
  it("집계 합 = 총 송장 수", () => {
    const rows = [sh({}), sh({ countryCode: "JP" }), sh({ countryCode: "KR", sourceSheetId: DOMESTIC_SID })];
    const a = aggregateLogistics(rows);
    expect(a.total).toBe(3);
    expect(a.byCountry.reduce((s, c) => s + c.n, 0)).toBe(3);
    expect(a.byCarrier.reduce((s, c) => s + c.n, 0)).toBe(3);
  });

  it("국내 fee=null은 글로벌 물류비에 미합산(정직)", () => {
    const rows = [
      sh({ feeKrw: 2000, sourceSheetId: GLOBAL_SID }),
      sh({ feeKrw: null, sourceSheetId: DOMESTIC_SID, countryCode: "KR" }),
    ];
    const a = aggregateLogistics(rows);
    expect(a.feeGlobalKrw).toBe(2000); // 국내 null 미합산
    expect(a.domesticFeeMissing).toBe(true);
    expect(a.global).toBe(1);
    expect(a.domestic).toBe(1);
  });

  it("country None은 brand_tag로 라벨(H&H, 미상 아님)", () => {
    const rows = [sh({ countryCode: null, brandTag: "H&H" })];
    const a = aggregateLogistics(rows);
    expect(a.byCountry[0].label).toBe("H&H");
  });

  it("H&H 제외 물류비 분리", () => {
    const rows = [sh({ feeKrw: 1000, brandTag: null }), sh({ feeKrw: 500, countryCode: null, brandTag: "H&H" })];
    const a = aggregateLogistics(rows);
    expect(a.feeGlobalKrw).toBe(1500);
    expect(a.feeExclHHKrw).toBe(1000); // H&H 제외
  });

  it("매칭 송장 수 집계", () => {
    const rows = [sh({ matchStatus: "matched" }), sh({ matchStatus: "matched" }), sh({ matchStatus: "unmatched" })];
    const a = aggregateLogistics(rows, 5);
    expect(a.matched).toBe(2);
    expect(a.matchedCollabs).toBe(5);
  });

  it("delivery_status None은 Unknown으로 투명 집계", () => {
    const rows = [sh({ deliveryStatus: null }), sh({ deliveryStatus: "출고" })];
    const a = aggregateLogistics(rows);
    expect(a.byStatus.find((s) => s.status === "Unknown")?.n).toBe(1);
    expect(a.byStatus.find((s) => s.status === "Shipped")?.n).toBe(1);
  });
});
