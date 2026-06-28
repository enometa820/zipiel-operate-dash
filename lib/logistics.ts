// lib/logistics.ts — 물류(shipments) 순수 집계. DB 호출 없음, 테스트 가능.
// 정직 표기: 국내 fee=null은 합산 제외(미수집), country None은 brand_tag로 라벨(타브랜드), 상태 None=Unknown.

export const GLOBAL_SID = "1GlDP_shipping_receipt";
export const DOMESTIC_SID = "1GlDP_domestic_1579019407";

// delivery_status 한글 → 영어(운영 UI). 미인식은 원값 보존.
const STATUS_EN: Record<string, string> = {
  출고: "Shipped",
  취소: "Cancelled",
  반품: "Returned",
  "반환중 보류": "Return hold",
  반환중: "Returning",
  대기: "Pending",
  "대기중 부가": "Pending",
};
export function statusLabel(s?: string | null): string {
  if (!s || !s.trim()) return "Unknown";
  return STATUS_EN[s.trim()] ?? s.trim();
}

export interface ShipmentRecord {
  countryCode?: string | null;
  brandTag?: string | null;
  carrier?: string | null;
  feeKrw?: number | null;
  deliveryStatus?: string | null;
  sourceSheetId?: string | null;
  matchStatus?: string | null;
}

export interface LogisticsData {
  total: number;
  global: number;
  domestic: number;
  matched: number; // matched 송장 수
  matchedCollabs: number; // 연결된 협업 수(외부 인자)
  feeGlobalKrw: number; // 글로벌 물류비 합(국내 null 미합산)
  feeExclHHKrw: number; // H&H(타브랜드) 제외
  domesticFeeMissing: boolean; // 국내 fee 미수집 플래그(정직 표기용)
  byCountry: { label: string; n: number }[];
  byCarrier: { carrier: string; n: number; feeKrw: number }[];
  byStatus: { status: string; n: number }[];
}

export function aggregateLogistics(rows: ShipmentRecord[], matchedCollabs = 0): LogisticsData {
  const byCountry: Record<string, number> = {};
  const byCarrier: Record<string, { n: number; fee: number }> = {};
  const byStatus: Record<string, number> = {};
  let feeGlobal = 0;
  let feeExclHH = 0;
  let matched = 0;
  let global = 0;
  let domestic = 0;
  let domesticWithFee = 0;

  for (const r of rows) {
    const clabel = r.countryCode || r.brandTag || "Unknown"; // None은 brand_tag(H&H)로 정직 표기
    byCountry[clabel] = (byCountry[clabel] ?? 0) + 1;

    const carrier = r.carrier || "Unknown";
    byCarrier[carrier] = byCarrier[carrier] || { n: 0, fee: 0 };
    byCarrier[carrier].n++;
    byCarrier[carrier].fee += r.feeKrw ?? 0;

    const st = statusLabel(r.deliveryStatus);
    byStatus[st] = (byStatus[st] ?? 0) + 1;

    if (r.feeKrw && r.sourceSheetId === GLOBAL_SID) {
      // 명칭대로 글로벌 송장 fee만 합산 — 향후 국내 fee가 들어와도 "global fee"로 오분류 방지
      feeGlobal += r.feeKrw;
      if (r.brandTag !== "H&H") feeExclHH += r.feeKrw;
    }
    if (r.matchStatus === "matched") matched++;
    if (r.sourceSheetId === DOMESTIC_SID) {
      domestic++;
      if (r.feeKrw) domesticWithFee++;
    } else if (r.sourceSheetId === GLOBAL_SID) {
      global++;
    }
  }

  return {
    total: rows.length,
    global,
    domestic,
    matched,
    matchedCollabs,
    feeGlobalKrw: feeGlobal,
    feeExclHHKrw: feeExclHH,
    domesticFeeMissing: domestic > 0 && domesticWithFee === 0, // 국내 fee 전무 → 미수집 명시
    byCountry: Object.entries(byCountry).map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n),
    byCarrier: Object.entries(byCarrier).map(([carrier, v]) => ({ carrier, n: v.n, feeKrw: v.fee })).sort((a, b) => b.n - a.n),
    byStatus: Object.entries(byStatus).map(([status, n]) => ({ status, n })).sort((a, b) => b.n - a.n),
  };
}
