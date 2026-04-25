import { LoginForm } from "@/components/forms/login-form";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,118,110,0.12),_transparent_35%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-6 py-10">
      <div className="mx-auto grid min-h-[85vh] max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-6">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Real Estate SMS CRM</p>
          <h1 className="max-w-xl text-5xl font-semibold tracking-tight text-slate-950">
            Keep seller leads, follow-ups, and SMS conversations in one place.
          </h1>
          <p className="max-w-lg text-lg text-slate-600">
            A clean SaaS dashboard for acquisition teams using Supabase for data and Telnyx for compliant texting.
          </p>
        </section>

        <section className="rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-card backdrop-blur">
          <h2 className="text-2xl font-semibold">Sign in</h2>
          <p className="mt-2 text-sm text-muted">Use your Supabase Auth email and password to access the CRM.</p>
          <div className="mt-6">
            <LoginForm error={params.error} />
          </div>
        </section>
      </div>
    </main>
  );
}
