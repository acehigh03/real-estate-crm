import type { Metadata } from "next";
import Link from "next/link";

import { SmsOptInForm } from "@/components/forms/sms-opt-in-form";

export const metadata: Metadata = {
  title: "SMS Opt-In | SSB Management",
  description: "Choose to receive real estate and property-related text messages from SSB Management.",
};

export default function SmsOptInPage() {
  return (
    <main className="min-h-screen bg-[#f3f6f8] px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-xl">
        <header className="mb-6 flex items-center justify-between">
          <Link href="/opt-in" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#00a878] text-sm font-bold text-white">S</div>
            <div>
              <p className="text-sm font-semibold text-[#1a1f36]">sellingmy.casa</p>
              <p className="text-xs text-[#6b7c93]">SSB Management</p>
            </div>
          </Link>
          <Link href="/privacy" className="text-xs font-medium text-[#008e67] hover:underline">Privacy</Link>
        </header>

        <section className="rounded-2xl border border-[#e1e7ed] bg-white p-6 shadow-[0_10px_35px_rgba(34,52,68,0.07)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#008e67]">SMS updates</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#1a1f36]">Stay in touch about your property</h1>
          <p className="mb-7 mt-2 text-sm leading-6 text-[#596579]">
            Enter your information below and choose whether you want to receive text messages from SSB Management.
          </p>
          <SmsOptInForm />
        </section>

        <p className="mt-5 text-center text-xs leading-5 text-[#6b7c93]">
          Questions? Email <a href="mailto:sam@sellingmy.casa" className="text-[#008e67] hover:underline">sam@sellingmy.casa</a>.
        </p>
      </div>
    </main>
  );
}
