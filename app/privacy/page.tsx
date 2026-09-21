import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | sellingmy.casa",
  description: "How SSB Management collects, uses, and protects your information.",
};

// Public page: lives outside the (dashboard) route group so it needs no login.
export default function PrivacyPage() {
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
          <Link href="/terms" className="text-[13px] font-medium text-[#00c08b] hover:underline">
            Terms of Service
          </Link>
        </header>

        <article className="mt-8 rounded-xl border border-[#e8edf2] bg-white p-8 shadow-sm">
          <h1 className="text-[22px] font-semibold text-[#1a1f36]">Privacy Policy</h1>
          <p className="mt-1.5 text-[13px] text-[#6b7c93]">
            SSB Management · sellingmy.casa · Effective date: September 18, 2026
          </p>

          <div className="mt-6 space-y-6 text-[14px] leading-6 text-[#3c4257]">
            <p>
              SSB Management (&ldquo;we,&rdquo; &ldquo;us&rdquo;) operates sellingmy.casa and contacts property
              owners about real estate cash offers. This policy explains what information we collect, how we
              use it, and the choices you have.
            </p>

            <section>
              <h2 className="text-[15px] font-semibold text-[#1a1f36]">SMS consent records</h2>
              <p className="mt-2">
                When you submit our SMS opt-in form, we record the phone number, the consent language shown,
                the date and time, the source page, and limited technical information used to document your
                choice. Mobile information and SMS consent will not be sold or shared with third parties for
                promotional or marketing purposes.
              </p>
            </section>

            <section>
              <h2 className="text-[15px] font-semibold text-[#1a1f36]">Information we collect</h2>
              <p className="mt-2">We collect the following information about property owners we contact:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Name</li>
                <li>Phone number</li>
                <li>Property address</li>
              </ul>
              <p className="mt-2">
                We also keep a record of the text messages exchanged with you, including your replies.
              </p>
            </section>

            <section>
              <h2 className="text-[15px] font-semibold text-[#1a1f36]">How we use your information</h2>
              <p className="mt-2">
                We use this information to contact you by SMS about real estate cash offers on your property,
                to respond to your replies, and to keep track of our conversations with you. We do not use it
                for any other purpose.
              </p>
            </section>

            <section>
              <h2 className="text-[15px] font-semibold text-[#1a1f36]">Opting out</h2>
              <p className="mt-2">
                You can stop receiving text messages from us at any time by replying{" "}
                <strong className="font-semibold text-[#1a1f36]">STOP</strong> to any message. After you opt
                out, we will not send you further messages. You can also contact us at the email address
                below.
              </p>
            </section>

            <section>
              <h2 className="text-[15px] font-semibold text-[#1a1f36]">Sharing of information</h2>
              <p className="mt-2">
                We do not sell your personal information to third parties. We do not share your phone number
                or SMS consent with third parties for their marketing purposes. Service providers that help us
                send messages and store our data process information only on our behalf and only to provide
                those services.
              </p>
            </section>

            <section>
              <h2 className="text-[15px] font-semibold text-[#1a1f36]">Contact us</h2>
              <p className="mt-2">
                Questions about this policy or your information? Email{" "}
                <a href="mailto:sam@sellingmy.casa" className="font-medium text-[#00c08b] hover:underline">
                  sam@sellingmy.casa
                </a>{" "}
                or visit{" "}
                <a href="https://sellingmy.casa" className="font-medium text-[#00c08b] hover:underline">
                  sellingmy.casa
                </a>
                .
              </p>
            </section>
          </div>
        </article>

        <footer className="mt-6 text-center text-[12px] text-[#6b7c93]">
          © 2026 SSB Management ·{" "}
          <Link href="/terms" className="hover:underline">
            Terms of Service
          </Link>
        </footer>
      </div>
    </main>
  );
}
