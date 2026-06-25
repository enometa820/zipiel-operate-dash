import { NavTabs } from "@/components/NavTabs";
import { Overview } from "@/components/Overview";
import { fetchOverviewStats } from "@/lib/queries";
import { supabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Overview (보는 화면) — 기본 진입. 매니저·effie가 파이프라인 건강도를 먼저 본다.
export default async function Home() {
  const stats = await fetchOverviewStats();
  const live = supabaseConfigured();
  return (
    <div className="max-w-[1100px] mx-auto px-5 py-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span className="text-[var(--accent)]">zipiel</span>
            <span className="text-[var(--faint)] font-normal">·</span>
            <span>Seeding Ops</span>
          </h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">Global influencer seeding pipeline — health at a glance</p>
        </div>
        <div className="flex items-center gap-3">
          <NavTabs />
          <span className="chip">{live ? "Supabase · live" : "Demo data · DB not connected"}</span>
        </div>
      </header>

      <Overview stats={stats} />
    </div>
  );
}
