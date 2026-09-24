"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, Kanban, Menu, MessageSquare, MoreHorizontal, Users, X } from "lucide-react";

const MOBILE_NAV = [
  { label: "Inbox", href: "/inbox", icon: MessageSquare },
  { label: "Today", href: "/scheduled", icon: CalendarClock },
  { label: "Pipeline", href: "/pipeline", icon: Kanban },
  { label: "Contacts", href: "/contacts", icon: Users },
] as const;

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

  const isActive = (href: string) =>
    pathname === href ||
    (href === "/inbox" && ["/", "/dashboard", "/messenger"].includes(pathname)) ||
    (href === "/contacts" && pathname.startsWith("/leads"));

  // Belt and braces: if anything ever scrolls the shell or sidebar sideways, snap it back so
  // the sidebar's first letters are never cut off.
  useEffect(() => {
    const pinned = () => [
      document.querySelector(".app-shell"),
      document.querySelector(".app-sidebar"),
      document.querySelector(".app-sidebar aside"),
      document.querySelector(".app-sidebar nav"),
      document.scrollingElement,
      document.body,
    ];
    const reset = () => pinned().forEach((element) => { if (element && element.scrollLeft !== 0) element.scrollLeft = 0; });
    reset();
    window.addEventListener("scroll", reset, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", reset, { capture: true });
  }, []);

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

      <nav className="app-mobile-nav" aria-label="Primary navigation">
        <div className="app-mobile-nav__rail">
          {MOBILE_NAV.map(({ label, href, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`app-mobile-nav__item${active ? " is-active" : ""}`}
              >
                <Icon size={19} strokeWidth={active ? 2.4 : 1.9} aria-hidden />
                <span>{label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            className={`app-mobile-nav__item${open ? " is-active" : ""}`}
            aria-label={open ? "Close more navigation" : "Open more navigation"}
            aria-expanded={open}
            aria-controls="app-sidebar"
            onClick={() => setOpen((value) => !value)}
          >
            <MoreHorizontal size={20} strokeWidth={2} aria-hidden />
            <span>More</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
