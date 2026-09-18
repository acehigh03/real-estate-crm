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
        <section className="relative flex flex-col justify-center bg-[#1a2332] px-6 py-7 text-white lg:px-14 lg:py-10">
          {/* Logo */}
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[#00c08b] text-[13px] font-semibold text-white">
                S
              </div>
              <div>
                <p className="text-[14px] font-semibold text-white">sellingmy.casa</p>
                <p className="text-[11px] text-white/45">Seller Acquisition Command Center</p>
              </div>
            </div>

            <h1 className="mt-6 max-w-md text-[1.6rem] lg:mt-12 lg:text-[2.25rem] font-semibold leading-[1.2] tracking-tight text-white">
              The seller-acquisition command center for real estate investors
            </h1>
            <p className="mt-3 max-w-md text-[14px] text-white/60 lg:mt-4 lg:text-[15px]">
              Find motivated sellers, reply instantly, and move deals to contract — all in one place.
            </p>

            <div className="mt-5 space-y-2.5 lg:mt-8 lg:space-y-3">
              {[
                "Never miss a motivated seller",
                "Every text, call, and follow-up in one place",
                "Know which deal to work next",
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
        </section>

        {/* Right: sign-in form */}
        <section className="flex items-center justify-center bg-[#f7f8fa] px-4 py-8 lg:px-10 lg:py-10">
          <div className="w-full max-w-sm rounded-xl border border-[#e8edf2] bg-white p-8 shadow-sm">
            <h2 className="text-[22px] font-semibold text-[#1a1f36]">Sign in</h2>
            <p className="mt-1.5 text-[13px] text-[#6b7c93]">
              Sign in to see which sellers need you today.
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
