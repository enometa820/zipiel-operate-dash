import { DashboardClient } from "@/components/DashboardClient";
import { fetchCollaborationViews } from "@/lib/queries";
import { supabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Work board (하는 화면) — 시트형 그리드(좌측 사이드바 + 상태 그룹 + detail 패널).
// 기본은 sourcing 제외(active만, 빠름). ?all=1이면 발굴 풀까지 전체 로드.
export default async function BoardPage({ searchParams }: { searchParams: Promise<{ all?: string; stuck?: string }> }) {
  const sp = await searchParams;
  const all = sp?.all === "1";
  const stuck = sp?.stuck === "1";
  const views = await fetchCollaborationViews({ includeSourcing: all });
  const live = supabaseConfigured();
  return <DashboardClient initial={views} loadedAll={all} live={live} initialStuck={stuck} />;
}
