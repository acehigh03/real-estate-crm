"use client";

import { useFormStatus } from "react-dom";

import { signIn } from "@/app/actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-[6px] bg-[#0f1117] px-4 py-3 text-sm font-medium text-white transition disabled:opacity-70"
    >
      {pending ? "Signing in..." : "Sign in"}
    </button>
  );
}

export function LoginForm({ error }: { error?: string }) {
  return (
    <form action={signIn} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full rounded-[6px] border border-[#eaecf0] bg-white px-4 py-3 text-sm"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="w-full rounded-[6px] border border-[#eaecf0] bg-white px-4 py-3 text-sm"
        />
      </div>

      {error ? (
        <p className="rounded-[6px] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
