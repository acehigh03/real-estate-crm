import Link from "next/link";
import { Home, Inbox, LogOut, Users } from "lucide-react";

import { signOut } from "@/app/actions";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/inbox", label: "Inbox", icon: Inbox }
];

export function Sidebar() {
  return (
    <aside className="flex h-full w-full max-w-xs flex-col border-r border-border bg-white">
      <div className="border-b border-border px-6 py-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">CRM</p>
        <h1 className="mt-2 text-2xl font-semibold">Seller Pipeline</h1>
      </div>

      <nav className="flex-1 space-y-2 px-4 py-6">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>

      <form action={signOut} className="border-t border-border p-4">
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </form>
    </aside>
  );
}
