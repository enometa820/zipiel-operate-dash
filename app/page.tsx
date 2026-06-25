import { DashboardClient } from "@/components/DashboardClient";
import { getCollaborationViews } from "@/lib/data";

export default function Home() {
  const views = getCollaborationViews();
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
        <span className="chip">Demo data · DB not connected</span>
      </header>

      <DashboardClient initial={views} />
    </div>
  );
}
