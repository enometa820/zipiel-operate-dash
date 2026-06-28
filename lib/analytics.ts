// lib/analytics.ts — 성과 분석 순수 집계(DB 호출 없음, 테스트 가능). queries.fetchAnalytics가 데이터를 넣어 호출.
// 진실: posted_at = 발행(완료), scheduled_post_date = 예정. 날조 0 — 미수집(views null/0)은 분모 제외·투명 표기.

export type Grain = "day" | "week" | "month";
export const GRAINS: Grain[] = ["day", "week", "month"];

// 매트릭스 제품 열 — 주력 3 + All/Mixed/Unknown. 순서 고정.
export const PRODUCT_COLS = ["Serum", "Cream", "Clay", "All", "Mixed", "Unknown"] as const;
export type ProductCol = (typeof PRODUCT_COLS)[number];

const ENGAGEMENT_FIELDS = ["likes", "comments", "reposts", "saves", "shares"] as const;

// 입력 평면 레코드(content_pieces + creator 조인)
export interface AnalyticsRecord {
  category?: string | null;
  postedAt?: string | null; // YYYY-MM-DD
  scheduledPostDate?: string | null;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  reposts?: number | null;
  saves?: number | null;
  shares?: number | null;
  country?: string | null;
  tier?: string | null;
}

// 카테고리 문자열 → 제품 열. 단일=해당 제품, "all"=All, 복수=Mixed, 빈=Unknown. 한/영 토큰 대응.
export function normalizeProduct(category?: string | null): ProductCol {
  if (!category || !category.trim()) return "Unknown";
  const tokens = category.split(/[;,]/).map((t) => t.trim()).filter(Boolean);
  const map = (t: string): string | null => {
    const s = t.toLowerCase();
    if (s === "all" || t === "전체") return "All";
    if (s.includes("serum") || t.includes("세럼")) return "Serum";
    if (s.includes("cream") || t.includes("크림")) return "Cream";
    if (s.includes("clay") || t.includes("클레이")) return "Clay";
    if (s.includes("mask") || t.includes("마스크")) return "Mask";
    return null;
  };
  const uniq = Array.from(new Set(tokens.map(map).filter(Boolean) as string[]));
  if (uniq.length === 0) return "Unknown";
  if (uniq.length === 1) {
    const one = uniq[0];
    if (one === "All") return "All";
    if (one === "Mask") return "Mixed"; // Mask 단독은 주력 열 아님 → Mixed
    return one as ProductCol; // Serum/Cream/Clay
  }
  return "Mixed"; // 복수 제품
}

// 날짜(YYYY-MM-DD) → grain 버킷 키. day=날짜, week=그 주 월요일(ISO), month=YYYY-MM.
export function bucketKey(dateStr: string, grain: Grain): string {
  if (grain === "month") return dateStr.slice(0, 7);
  if (grain === "day") return dateStr;
  const d = new Date(dateStr + "T00:00:00Z");
  const dow = d.getUTCDay(); // 0=일..6=토
  d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow)); // 월요일로
  return d.toISOString().slice(0, 10);
}

function engagementSum(r: AnalyticsRecord): number {
  return ENGAGEMENT_FIELDS.reduce((acc, f) => acc + (r[f] ?? 0), 0);
}

function pct(n: number, d: number): number | null {
  return d > 0 ? Math.round((n / d) * 1000) / 10 : null; // 소수 1자리 %, 분모0=null(날조 금지)
}

// --- 출력 타입 ---
export interface MatrixData {
  buckets: string[];
  products: ProductCol[]; // 데이터 있는 열만(PRODUCT_COLS 순서)
  cells: Record<string, Record<string, number>>; // bucket -> product -> count
  bucketTotals: Record<string, number>;
  productTotals: Record<string, number>;
  grandTotal: number;
}
export interface AchievementRow {
  country: string;
  scheduled: number;
  posted: number;
  rate: number | null;
}
export interface AchievementBucket {
  bucket: string;
  scheduled: number;
  posted: number;
  rate: number | null;
}
export interface AchievementData {
  scheduled: number;
  posted: number;
  rate: number | null;
  byCountry: AchievementRow[];
  byBucket: AchievementBucket[]; // grain별(예정일 기준 버킷), country 필터 적용
}
export interface EngagementRow {
  country: string;
  collected: number;
  avgPct: number | null;
}
export interface EngagementData {
  collected: number; // views>0 수
  total: number; // 전체 콘텐츠 수
  avgPct: number | null;
  byCountry: EngagementRow[];
}
export interface CountryProductData {
  countries: string[];
  products: ProductCol[];
  cells: Record<string, Record<string, number>>;
  countryTotals: Record<string, number>;
}
export interface CountryTierData {
  countries: string[];
  tiers: string[];
  cells: Record<string, Record<string, number>>;
  countryTotals: Record<string, number>;
}
export interface AnalyticsSummary {
  totalPosted: number;
  achievementRate: number | null;
  avgEngagementPct: number | null;
  engagementCollected: number;
  engagementTotal: number;
  activeCountries: number;
}
export interface AnalyticsData {
  grain: Grain;
  country: string; // "all" 또는 특정 국가
  countriesAvailable: string[];
  matrix: MatrixData;
  achievement: AchievementData;
  engagement: EngagementData;
  countryProduct: CountryProductData;
  countryTier: CountryTierData;
  summary: AnalyticsSummary;
}

const sortByCol = (cols: readonly string[]) => (a: string, b: string) => cols.indexOf(a) - cols.indexOf(b);
const TIER_ORDER = ["Mega", "Macro", "Mid", "Micro", "Nano", "Unknown"]; // enum: Nano·Micro·Mid·Macro·Mega

// 메인 집계. countryFilter("all" 또는 국가코드)는 매트릭스·요약에만 적용, 비교 패널(byCountry·countryProduct/Tier)은 전체.
export function aggregate(records: AnalyticsRecord[], grain: Grain, countryFilter = "all"): AnalyticsData {
  const countriesAvailable = Array.from(
    new Set(records.map((r) => r.country).filter((c): c is string => Boolean(c)))
  ).sort();

  const inFilter = (r: AnalyticsRecord) => countryFilter === "all" || r.country === countryFilter;

  // --- 매트릭스(발행=posted 있는 것, 필터 적용) ---
  const cells: Record<string, Record<string, number>> = {};
  const bucketTotals: Record<string, number> = {};
  const productTotals: Record<string, number> = {};
  const productSet = new Set<ProductCol>();
  let grandTotal = 0;
  for (const r of records) {
    if (!r.postedAt || !inFilter(r)) continue;
    const b = bucketKey(r.postedAt, grain);
    const p = normalizeProduct(r.category);
    cells[b] = cells[b] || {};
    cells[b][p] = (cells[b][p] ?? 0) + 1;
    bucketTotals[b] = (bucketTotals[b] ?? 0) + 1;
    productTotals[p] = (productTotals[p] ?? 0) + 1;
    productSet.add(p);
    grandTotal++;
  }
  const matrix: MatrixData = {
    buckets: Object.keys(cells).sort(),
    products: PRODUCT_COLS.filter((p) => productSet.has(p)),
    cells,
    bucketTotals,
    productTotals,
    grandTotal,
  };

  // --- 달성률(예정 있는 것 중 발행된 비율) — 전체·국가별(전체)·grain 버킷별(필터 적용) ---
  const achByCountry: Record<string, { scheduled: number; posted: number }> = {};
  const achByBucket: Record<string, { scheduled: number; posted: number }> = {};
  let schedAll = 0;
  let postedAll = 0;
  for (const r of records) {
    if (!r.scheduledPostDate) continue;
    const c = r.country ?? "Unknown";
    achByCountry[c] = achByCountry[c] || { scheduled: 0, posted: 0 };
    achByCountry[c].scheduled++;
    if (r.postedAt) achByCountry[c].posted++;
    if (inFilter(r)) {
      schedAll++;
      const b = bucketKey(r.scheduledPostDate, grain); // 예정일 기준 버킷
      achByBucket[b] = achByBucket[b] || { scheduled: 0, posted: 0 };
      achByBucket[b].scheduled++;
      if (r.postedAt) {
        postedAll++;
        achByBucket[b].posted++;
      }
    }
  }
  const achievement: AchievementData = {
    scheduled: schedAll,
    posted: postedAll,
    rate: pct(postedAll, schedAll),
    byCountry: Object.entries(achByCountry)
      .map(([country, v]) => ({ country, scheduled: v.scheduled, posted: v.posted, rate: pct(v.posted, v.scheduled) }))
      .sort((a, b) => b.scheduled - a.scheduled),
    byBucket: Object.keys(achByBucket)
      .sort()
      .map((bucket) => ({ bucket, scheduled: achByBucket[bucket].scheduled, posted: achByBucket[bucket].posted, rate: pct(achByBucket[bucket].posted, achByBucket[bucket].scheduled) })),
  };

  // --- 인게이지먼트(views>0만 분모) ---
  const engByCountry: Record<string, { collected: number; sumPct: number }> = {};
  let collectedAll = 0;
  let sumPctAll = 0;
  let totalFilter = 0;
  for (const r of records) {
    if (!inFilter(r)) continue;
    totalFilter++;
    const v = r.views ?? 0;
    if (v > 0) {
      const p = (engagementSum(r) / v) * 100;
      collectedAll++;
      sumPctAll += p;
      const c = r.country ?? "Unknown";
      engByCountry[c] = engByCountry[c] || { collected: 0, sumPct: 0 };
      engByCountry[c].collected++;
      engByCountry[c].sumPct += p;
    }
  }
  const engagement: EngagementData = {
    collected: collectedAll,
    total: totalFilter,
    avgPct: collectedAll > 0 ? Math.round((sumPctAll / collectedAll) * 10) / 10 : null,
    byCountry: Object.entries(engByCountry)
      .map(([country, v]) => ({ country, collected: v.collected, avgPct: Math.round((v.sumPct / v.collected) * 10) / 10 }))
      .sort((a, b) => b.collected - a.collected),
  };

  // --- 국가×제품(발행 기준, 전체) ---
  const cpCells: Record<string, Record<string, number>> = {};
  const cpCountryTotals: Record<string, number> = {};
  const cpProductSet = new Set<ProductCol>();
  for (const r of records) {
    if (!r.postedAt) continue;
    const c = r.country ?? "Unknown";
    const p = normalizeProduct(r.category);
    cpCells[c] = cpCells[c] || {};
    cpCells[c][p] = (cpCells[c][p] ?? 0) + 1;
    cpCountryTotals[c] = (cpCountryTotals[c] ?? 0) + 1;
    cpProductSet.add(p);
  }
  const countryProduct: CountryProductData = {
    countries: Object.keys(cpCells).sort(),
    products: PRODUCT_COLS.filter((p) => cpProductSet.has(p)),
    cells: cpCells,
    countryTotals: cpCountryTotals,
  };

  // --- 국가×티어(전체 콘텐츠) ---
  const ctCells: Record<string, Record<string, number>> = {};
  const ctCountryTotals: Record<string, number> = {};
  const ctTierSet = new Set<string>();
  for (const r of records) {
    const c = r.country ?? "Unknown";
    const t = r.tier ?? "Unknown";
    ctCells[c] = ctCells[c] || {};
    ctCells[c][t] = (ctCells[c][t] ?? 0) + 1;
    ctCountryTotals[c] = (ctCountryTotals[c] ?? 0) + 1;
    ctTierSet.add(t);
  }
  const countryTier: CountryTierData = {
    countries: Object.keys(ctCells).sort(),
    tiers: Array.from(ctTierSet).sort(sortByCol(TIER_ORDER)),
    cells: ctCells,
    countryTotals: ctCountryTotals,
  };

  const summary: AnalyticsSummary = {
    totalPosted: grandTotal,
    achievementRate: achievement.rate,
    avgEngagementPct: engagement.avgPct,
    engagementCollected: engagement.collected,
    engagementTotal: engagement.total,
    activeCountries: matrix.buckets.length ? new Set(records.filter((r) => r.postedAt && inFilter(r)).map((r) => r.country)).size : 0,
  };

  return { grain, country: countryFilter, countriesAvailable, matrix, achievement, engagement, countryProduct, countryTier, summary };
}
