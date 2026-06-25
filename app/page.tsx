import Link from "next/link";
import { DashboardClient } from "@/components/DashboardClient";
import { fetchCollaborationViews } from "@/lib/queries";
import { supabaseConfigured } from "@/lib/supabase";

export default async function Home() {
  const views = await fetchCollaborationViews();
  const live = supabaseConfigured();
  return (
    <div className="max-w-[1400px] mx-auto px-5 py-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span className="text-[var(--accent)]">zipiel</span>
            <span className="text-[var(--faint)] font-normal">·</span>
            <span>Seeding Ops</span>
          </h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">
            Global influencer seeding &amp; collaboration pipeline
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/status" className="text-sm text-[var(--accent)] hover:underline">개발 현황</Link>
          <span className="chip">{live ? "Supabase · live" : "Demo data · DB not connected"}</span>
        </div>
      </header>

      <DashboardClient initial={views} />
    </div>
  );
}
