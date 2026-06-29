// effie "우리의 실제 데이터"(슬랙 06-26) = 온에어 시트 + the frameless seeding operation 시트
// + 작업자 앱 입력. 옛 2026 컨택 리스트(legacy)는 실제 데이터가 아니라 발굴 풀 — 운영 지표·달성률
// 에서 분리하고, 발굴 소스로만 보존한다(중복 인원은 in_legacy_list로 표시). AF는 차주 적재 예정.
export const REAL_DATA_SOURCES = ["onair_2026", "seeding_op_2026", "manual"] as const;
export const LEGACY_SOURCE = "legacy_contact_list";

export function isRealData(sourceSystem?: string | null): boolean {
  return !!sourceSystem && (REAL_DATA_SOURCES as readonly string[]).includes(sourceSystem);
}
