import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | sellingmy.casa",
  description: "SMS terms and conditions for messages from SSB Management.",
};

// Public page: lives outside the (dashboard) route group so it needs no login.
export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#f7f8fa] px-6 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[#00c08b] text-[13px] font-semibold text-white">
              S
            </div>
            <div>
              <p className="text-[14px] font-semibold text-[#1a1f36]">sellingmy.casa</p>
              <p className="text-[11px] text-[#6b7c93]">SSB Management</p>
            </div>
          </div>
          <Link href="/privacy" className="text-[13px] font-medium text-[#00c08b] hover:underline">
            Privacy Policy
          </Link>
        </header>

        <article className="mt-8 rounded-xl border border-[#e8edf2] bg-white p-8 shadow-sm">
          <h1 className="text-[22px] font-semibold text-[#1a1f36]">Terms of Service</h1>
          <p className="mt-1.5 text-[13px] text-[#6b7c93]">
            SSB Management · sellingmy.casa · SMS Terms &amp; Conditions
          </p>

          <div className="mt-6 space-y-6 text-[14px] leading-6 text-[#3c4257]">
            <section>
              <h2 className="text-[15px] font-semibold text-[#1a1f36]">SMS consent</h2>
              <p className="mt-2">
                By providing your phone number, you consent to receive SMS text messages from SSB Management
                about cash offers on real estate. Consent is not a condition of any purchase or sale.
              </p>
            </section>

            <section>
              <h2 className="text-[15px] font-semibold text-[#1a1f36]">Message frequency</h2>
              <p className="mt-2">Message frequency varies.</p>
            </section>

            <section>
              <h2 className="text-[15px] font-semibold text-[#1a1f36]">Message and data rates</h2>
              <p className="mt-2">Message and data rates may apply, depending on your mobile carrier and plan.</p>
            </section>

            <section>
              <h2 className="text-[15px] font-semibold text-[#1a1f36]">Opt out and help</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  Reply <strong className="font-semibold text-[#1a1f36]">STOP</strong> at any time to
                  unsubscribe. You will receive no further messages after you opt out.
                </li>
                <li>
                  Reply <strong className="font-semibold text-[#1a1f36]">HELP</strong> for help.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-[15px] font-semibold text-[#1a1f36]">Privacy</h2>
              <p className="mt-2">
                How we handle your information is described in our{" "}
                <Link href="/privacy" className="font-medium text-[#00c08b] hover:underline">
                  Privacy Policy
                </Link>
                .
              </p>
            </section>

            <section>
              <h2 className="text-[15px] font-semibold text-[#1a1f36]">Contact</h2>
              <p className="mt-2">
                SSB Management ·{" "}
                <a href="mailto:sam@sellingmy.casa" className="font-medium text-[#00c08b] hover:underline">
                  sam@sellingmy.casa
                </a>{" "}
                ·{" "}
                <a href="https://sellingmy.casa" className="font-medium text-[#00c08b] hover:underline">
                  sellingmy.casa
                </a>
              </p>
            </section>
          </div>
        </article>

        <footer className="mt-6 text-center text-[12px] text-[#6b7c93]">
          © 2026 SSB Management ·{" "}
          <Link href="/privacy" className="hover:underline">
            Privacy Policy
          </Link>
        </footer>
      </div>
    </main>
  );
}
