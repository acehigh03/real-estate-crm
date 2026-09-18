"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

// Desktop: sidebar + content side by side. Phones: content full-width with a slide-in menu.
export function AppShell({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer after navigating, and on Escape.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="app-shell">
      <div className="app-mobile-bar">
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="app-sidebar"
          onClick={() => setOpen((value) => !value)}
          style={{
            width: 36,
            height: 36,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 8,
            border: "1px solid var(--b2)",
            background: "var(--s1)",
            color: "var(--t1)",
          }}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)", letterSpacing: "-0.01em" }}>
          sellingmy.casa
        </span>
      </div>

      <div id="app-sidebar" className={`app-sidebar${open ? " is-open" : ""}`}>
        {sidebar}
      </div>
      {open ? <button type="button" className="app-scrim" aria-label="Close menu" onClick={() => setOpen(false)} /> : null}

      <main className="app-main">{children}</main>
    </div>
  );
}
