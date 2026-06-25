import { NavTabs } from "@/components/NavTabs";
import { DashboardClient } from "@/components/DashboardClient";
import { fetchCollaborationViews } from "@/lib/queries";
import { supabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Work board (하는 화면) — 운영자가 시트처럼 협업을 굴리는 작업면.
export default async function BoardPage() {
  const views = await fetchCollaborationViews();
  const live = supabaseConfigured();
  return (
    <div className="max-w-[1500px] mx-auto px-5 py-6">
      <header className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span className="text-[var(--accent)]">zipiel</span>
            <span className="text-[var(--faint)] font-normal">·</span>
            <span>Work board</span>
          </h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">
            Filter, scan and edit collaborations like a sheet — code removes the bottlenecks
          </p>
        </div>
        <div className="flex items-center gap-3">
          <NavTabs />
          <span className="chip">{live ? "Supabase · live" : "Demo data · DB not connected"}</span>
        </div>
      </header>

      <DashboardClient initial={views} />
    </div>
  );
}
