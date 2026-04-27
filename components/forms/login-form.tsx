"use client";

import { useFormStatus } from "react-dom";

import { signIn } from "@/app/actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-[6px] bg-[#00c08b] px-4 py-3 text-[13px] font-medium text-white transition hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "Signing in..." : "Sign in"}
    </button>
  );
}

export function LoginForm({ error }: { error?: string }) {
  return (
    <form action={signIn} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-[13px] font-medium text-[#1a1f36]">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full rounded-[6px] border border-[#e8edf2] bg-white px-4 py-2.5 text-[13px] text-[#1a1f36] placeholder:text-[#6b7c93] focus:border-[#00c08b] focus:ring-2 focus:ring-[#eaf9f5]"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-[13px] font-medium text-[#1a1f36]">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="w-full rounded-[6px] border border-[#e8edf2] bg-white px-4 py-2.5 text-[13px] text-[#1a1f36] placeholder:text-[#6b7c93] focus:border-[#00c08b] focus:ring-2 focus:ring-[#eaf9f5]"
        />
      </div>

      {error ? (
        <p className="rounded-[6px] bg-[#fef2f2] px-4 py-3 text-[13px] text-[#e5484d]">{error}</p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
