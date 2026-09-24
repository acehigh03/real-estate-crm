"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

const DISCLOSURE =
  "I agree to receive recurring marketing and promotional SMS text messages from SSB Management regarding real estate and property services at the mobile number provided. Message frequency may vary. Message and data rates may apply. Reply STOP to opt out. Reply HELP for help. Consent is not a condition of purchase.";

export function SmsOptInForm() {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setError("");

    const form = event.currentTarget;
    const data = new FormData(form);
    const phone = String(data.get("phone") || "").trim();
    const consented = data.get("consented") === "on";

    if (consented && !phone) {
      setError("Please enter a mobile number to receive SMS messages.");
      setStatus("error");
      return;
    }

    const response = await fetch("/api/sms-opt-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName: data.get("fullName"),
        phone,
        propertyAddress: data.get("propertyAddress"),
        consented,
        website: data.get("website"),
      }),
    });

    const body = (await response.json().catch(() => null)) as { error?: string; reference?: string; consented?: boolean } | null;
    if (!response.ok) {
      const reference = body?.reference ? ` Error code: ${body.reference}` : "";
      setError(`${body?.error || "We could not save your request. Please try again."}${reference}`);
      setStatus("error");
      return;
    }

    form.reset();
    setSubscribed(body?.consented === true);
    setStatus("success");
  }

  if (status === "success") {
    return (
      <div className="rounded-xl border border-[#b8eadb] bg-[#effcf7] p-6 text-center" role="status">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#00a878] text-xl text-white">✓</div>
        <h2 className="mt-3 text-lg font-semibold text-[#1a1f36]">{subscribed ? "You’re signed up" : "Request submitted"}</h2>
        <p className="mt-1 text-sm leading-6 text-[#596579]">
          {subscribed
            ? "SSB Management may now text you at the number you provided. Reply STOP at any time to unsubscribe."
            : "You were not enrolled in SMS updates because text-message consent was not selected."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label htmlFor="fullName" className="text-sm font-medium text-[#1a1f36]">Full name</label>
        <input id="fullName" name="fullName" required autoComplete="name" maxLength={120}
          className="mt-1.5 w-full rounded-lg border border-[#d8dee8] bg-white px-3.5 py-3 text-base text-[#1a1f36] focus:border-[#00a878] focus:ring-2 focus:ring-[#00a878]/15" />
      </div>

      <div>
        <label htmlFor="phone" className="text-sm font-medium text-[#1a1f36]">Mobile phone number (optional)</label>
        <input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="(713) 555-0123" maxLength={30}
          className="mt-1.5 w-full rounded-lg border border-[#d8dee8] bg-white px-3.5 py-3 text-base text-[#1a1f36] focus:border-[#00a878] focus:ring-2 focus:ring-[#00a878]/15" />
      </div>

      <div>
        <label htmlFor="propertyAddress" className="text-sm font-medium text-[#1a1f36]">Property address <span className="font-normal text-[#7b8798]">(optional)</span></label>
        <input id="propertyAddress" name="propertyAddress" autoComplete="street-address" maxLength={240}
          className="mt-1.5 w-full rounded-lg border border-[#d8dee8] bg-white px-3.5 py-3 text-base text-[#1a1f36] focus:border-[#00a878] focus:ring-2 focus:ring-[#00a878]/15" />
      </div>

      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <p className="text-sm text-[#596579]">Phone number and SMS consent are optional. You can submit this form without signing up for text messages.</p>

      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#d8dee8] bg-[#f8fafb] p-4">
        <input name="consented" type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[#00a878]" />
        <span className="text-[13px] leading-5 text-[#3c4257]">
          <span className="font-semibold">Optional SMS consent:</span>{" "}{DISCLOSURE} Mobile information and SMS consent will not be sold or shared with third parties for promotional or marketing purposes. View our{" "}
          <Link href="/privacy" target="_blank" className="font-medium text-[#008e67] underline">Privacy Policy</Link>{" "}
          and <Link href="/terms" target="_blank" className="font-medium text-[#008e67] underline">Terms &amp; Conditions</Link>.
        </span>
      </label>

      {status === "error" && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={status === "submitting"}
        className="w-full rounded-lg bg-[#00a878] px-4 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-[#008e67] disabled:cursor-not-allowed disabled:opacity-60">
        {status === "submitting" ? "Submitting…" : "Submit"}
      </button>
    </form>
  );
}
