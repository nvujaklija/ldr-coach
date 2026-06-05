"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import NotificationCenter from "@/components/NotificationCenter";
import { getSettings } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { applyTheme } from "@/lib/theme";

/** Primary navigation. Each feature lives on its own screen. */
export const NAV_ITEMS = [
  { href: "/app", label: "Home", icon: "🏡" },
  { href: "/app/rituals", label: "Rituals", icon: "🕯️" },
  { href: "/app/letters", label: "Letters", icon: "✉️" },
  { href: "/app/memories", label: "Memories", icon: "📸" },
  { href: "/app/bucket-list", label: "Bucket List", icon: "✨" },
  { href: "/app/settings", label: "Settings", icon: "⚙️" },
] as const;

/** True when `href` is the active route (exact for Home, prefix for the rest). */
function isActive(pathname: string, href: string): boolean {
  return href === "/app" ? pathname === "/app" : pathname.startsWith(href);
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() ?? "/app";
  return (
    <nav className="nav" aria-label="Primary">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          aria-current={isActive(pathname, item.href) ? "page" : undefined}
          className={
            isActive(pathname, item.href) ? "nav-link active" : "nav-link"
          }
        >
          <span className="nav-icon" aria-hidden="true">
            {item.icon}
          </span>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Persistent left sidebar on desktop; a top bar with a slide-in drawer on
 * mobile. Also reflects the user's saved theme app-wide and surfaces the
 * notification center on every screen.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { token } = useAuth();

  // Apply the user's saved theme on any app screen (not just the dashboard).
  useEffect(() => {
    if (!token) return;
    getSettings(token)
      .then((s) => applyTheme(s.user.theme))
      .catch(() => {
        /* theme is a preference; the default still works without settings */
      });
  }, [token]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="app-shell">
      <header className="topnav">
        <button
          type="button"
          className="menu-button"
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          ☰
        </button>
        <Link href="/app" className="brand">
          <span aria-hidden="true">💕</span> LDR Coach
        </Link>
        <div className="topnav-actions">
          <NotificationCenter />
        </div>
      </header>

      <button
        type="button"
        aria-label="Close menu"
        className={open ? "scrim open" : "scrim"}
        onClick={() => setOpen(false)}
      />

      <aside className={open ? "sidebar open" : "sidebar"}>
        <Link href="/app" className="brand">
          <span aria-hidden="true">💕</span> LDR Coach
        </Link>
        <NavLinks onNavigate={() => setOpen(false)} />
        <p className="sidebar-footer">Close, across the distance.</p>
      </aside>

      <main className="app-content">
        <div className="app-content-inner">{children}</div>
      </main>
    </div>
  );
}
