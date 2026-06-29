// 그리드 환경설정 — 밀도·그룹핑·컬럼 가시성/순서/접힘. localStorage 영속.
export type Density = "condensed" | "regular" | "relaxed";
export type GroupBy = "phase" | "status" | "none";

// 행높이·셀/헤더 패딩·폰트 프리셋. regular = 기존 ROW_H 40.
export const DENSITY: Record<Density, { rowH: number; cell: string; head: string }> = {
  condensed: { rowH: 32, cell: "text-[11px] px-1.5", head: "text-[11px] px-1.5 py-1.5" },
  regular: { rowH: 40, cell: "text-xs px-2", head: "text-xs px-2 py-2" },
  relaxed: { rowH: 48, cell: "text-sm px-3", head: "text-sm px-3 py-2.5" },
};

// 그리드 컬럼 — id는 columns.tsx와 일치. label은 컬럼 매니저 표시용.
export const GRID_COLUMNS: { id: string; label: string; defaultVisible: boolean }[] = [
  { id: "creator", label: "Creator", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "platform", label: "Platform", defaultVisible: true },
  { id: "followers", label: "Followers", defaultVisible: true },
  { id: "manager", label: "Manager", defaultVisible: true },
  { id: "last", label: "Last contact", defaultVisible: true },
  { id: "fee", label: "Fee (KRW)", defaultVisible: true },
  { id: "listed", label: "Listed", defaultVisible: true },
  { id: "tier", label: "Tier", defaultVisible: false },
  { id: "type", label: "Campaign", defaultVisible: false },
  { id: "scheduled", label: "Scheduled post", defaultVisible: false },
  { id: "cpv", label: "CPV", defaultVisible: false },
  { id: "post", label: "Post URL", defaultVisible: false },
];

const DEFAULT_COLUMN_ORDER = GRID_COLUMNS.map((c) => c.id);
// creator는 항상 첫 컬럼(frozen 안전장치) — 순서 변경/숨김 불가.
export const LOCKED_COLUMN = "creator";

function defaultVisibility(): Record<string, boolean> {
  const v: Record<string, boolean> = {};
  for (const c of GRID_COLUMNS) v[c.id] = c.defaultVisible;
  return v;
}

export interface GridPrefs {
  density: Density;
  groupBy: GroupBy;
  columnVisibility: Record<string, boolean>;
  columnOrder: string[];
  collapsedGroups: string[]; // 접힌 그룹 key(phase 라벨 또는 status)
}

export const DEFAULT_PREFS: GridPrefs = {
  density: "regular",
  groupBy: "phase",
  columnVisibility: defaultVisibility(),
  columnOrder: DEFAULT_COLUMN_ORDER,
  collapsedGroups: [],
};

export const PREFS_KEY = "board-grid-prefs-v1";

// 저장된 prefs를 기본값과 병합(스키마 진화 안전 — 새 컬럼 추가 시 누락 보정).
export function mergePrefs(saved: Partial<GridPrefs> | null): GridPrefs {
  if (!saved) return DEFAULT_PREFS;
  const vis = { ...defaultVisibility(), ...(saved.columnVisibility ?? {}) };
  const savedOrder = saved.columnOrder ?? DEFAULT_COLUMN_ORDER;
  // 누락된 컬럼 id를 끝에 보강, 없는 id 제거
  const order = [
    ...savedOrder.filter((id) => DEFAULT_COLUMN_ORDER.includes(id)),
    ...DEFAULT_COLUMN_ORDER.filter((id) => !savedOrder.includes(id)),
  ];
  return {
    density: saved.density ?? DEFAULT_PREFS.density,
    groupBy: saved.groupBy ?? DEFAULT_PREFS.groupBy,
    columnVisibility: vis,
    columnOrder: order,
    collapsedGroups: saved.collapsedGroups ?? [],
  };
}
