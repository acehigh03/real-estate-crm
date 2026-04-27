import { LoginForm } from "@/components/forms/login-form";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-[#f8f9fb]">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="flex flex-col justify-between bg-[linear-gradient(180deg,#0f1117_0%,#16213a_55%,#0f3460_100%)] px-8 py-10 text-white lg:px-12">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#10b981] text-sm font-semibold text-white">
                SP
              </div>
              <div>
                <p className="text-sm font-medium">Seller Pipeline</p>
                <p className="text-xs text-white/45">sellingmy.casa</p>
              </div>
            </div>
            <h1 className="mt-10 max-w-xl text-5xl font-semibold tracking-tight">
              Close more seller conversations from one calm workspace.
            </h1>
            <p className="mt-5 max-w-lg text-base text-white/65">
              Manage follow-ups, inbox threads, pipeline stages, and CSV imports without switching tools.
            </p>

            <div className="mt-8 space-y-3 text-sm text-white/72">
              <div className="flex items-center gap-3">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10b981]" />
                Supabase-powered lead and auth workflow
              </div>
              <div className="flex items-center gap-3">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10b981]" />
                Telnyx messaging with STOP compliance built in
              </div>
              <div className="flex items-center gap-3">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10b981]" />
                Daily seller pipeline and follow-up tracking
              </div>
            </div>
          </div>

          <div className="grid max-w-md grid-cols-3 gap-3">
            <div className="rounded-[10px] border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-xs text-white/50">Inbox</p>
              <p className="mt-2 text-2xl font-semibold">1</p>
            </div>
            <div className="rounded-[10px] border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-xs text-white/50">Pipeline</p>
              <p className="mt-2 text-2xl font-semibold">6</p>
            </div>
            <div className="rounded-[10px] border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-xs text-white/50">CRM</p>
              <p className="mt-2 text-2xl font-semibold">24/7</p>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-10 lg:px-10">
          <div className="w-full max-w-md rounded-[10px] border border-[#eaecf0] bg-white p-8">
            <h2 className="text-2xl font-semibold text-[#0f1117]">Sign in</h2>
            <p className="mt-2 text-sm text-[#6b7280]">Use your Supabase Auth email and password to access the CRM.</p>
            <div className="mt-6">
              <LoginForm error={params.error} />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
