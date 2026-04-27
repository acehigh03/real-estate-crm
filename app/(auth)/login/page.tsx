import { LoginForm } from "@/components/forms/login-form";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="min-h-screen">
      <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
        {/* Left: dark panel */}
        <section className="relative flex flex-col justify-between bg-[linear-gradient(160deg,#1e2a3a_0%,#1a2f4a_55%,#162540_100%)] px-10 py-10 text-white lg:px-14">
          {/* Logo */}
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[#00c08b] text-[13px] font-semibold text-white">
                S
              </div>
              <div>
                <p className="text-[14px] font-semibold text-white">sellingmy.casa</p>
                <p className="text-[11px] text-white/45">Real Estate CRM</p>
              </div>
            </div>

            {/* Badge */}
            <div className="mt-10">
              <span className="inline-flex items-center rounded-full bg-[#00c08b]/15 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-[#00c08b]">
                Real Estate CRM
              </span>
            </div>

            <h1 className="mt-5 max-w-md text-[2.25rem] font-semibold leading-[1.2] tracking-tight text-white">
              Manage seller leads, follow-ups, and SMS in one place.
            </h1>
            <p className="mt-4 text-[15px] text-white/55">
              Built for investors who move fast.
            </p>

            <div className="mt-8 space-y-3">
              {[
                "Supabase-powered lead and auth workflow",
                "Telnyx SMS with STOP compliance built in",
                "Daily seller pipeline and follow-up tracking",
              ].map((point) => (
                <div key={point} className="flex items-center gap-3 text-[14px] text-white/70">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#00c08b]/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#00c08b]" />
                  </span>
                  {point}
                </div>
              ))}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid max-w-sm grid-cols-3 gap-3">
            {[
              { label: "Leads", value: "∞" },
              { label: "Replies", value: "Live" },
              { label: "Hot Leads", value: "Auto" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-[8px] border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-[11px] text-white/45">{stat.label}</p>
                <p className="mt-1.5 text-[20px] font-semibold text-white">{stat.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Right: sign-in form */}
        <section className="flex items-center justify-center bg-[#f7f8fa] px-6 py-10 lg:px-10">
          <div className="w-full max-w-sm rounded-xl border border-[#e8edf2] bg-white p-8 shadow-sm">
            <h2 className="text-[22px] font-semibold text-[#1a1f36]">Sign in</h2>
            <p className="mt-1.5 text-[13px] text-[#6b7c93]">
              Use your email and password to access the CRM.
            </p>
            <div className="mt-6">
              <LoginForm error={params.error} />
            </div>
            <p className="mt-5 text-center text-[12px] text-[#6b7c93]">
              Need access?{" "}
              <span className="font-medium text-[#00c08b]">Contact your admin</span>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
