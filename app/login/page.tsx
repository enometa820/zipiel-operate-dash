import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form action={login} className="card p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <span className="text-[var(--accent)]">zipiel</span>
          <span className="text-[var(--faint)] font-normal">·</span>
          <span>Seeding Ops</span>
        </h1>
        <p className="text-sm text-[var(--muted)] mt-1 mb-6">Sign in to continue</p>

        <label className="block text-xs text-[var(--muted)] mb-1">ID</label>
        <input
          name="username"
          autoComplete="username"
          className="w-full px-3 py-2 mb-4 rounded-lg border border-[var(--border-strong)] bg-[var(--panel)] outline-none focus:border-[var(--accent)]"
        />

        <label className="block text-xs text-[var(--muted)] mb-1">Password</label>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          className="w-full px-3 py-2 mb-2 rounded-lg border border-[var(--border-strong)] bg-[var(--panel)] outline-none focus:border-[var(--accent)]"
        />

        {error && (
          <p className="text-sm text-[var(--phase-dropped)] mb-2">Invalid credentials</p>
        )}

        <button
          type="submit"
          className="w-full mt-4 px-3 py-2 rounded-lg bg-[var(--accent)] text-white font-medium hover:opacity-90"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
