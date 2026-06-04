"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BucketListSection from "@/components/BucketListSection";
import CheckInCard from "@/components/CheckInCard";
import CoupleOnboarding from "@/components/CoupleOnboarding";
import LettersSection from "@/components/LettersSection";
import MemoriesTimeline from "@/components/MemoriesTimeline";
import NextVisitWidget from "@/components/NextVisitWidget";
import NotificationCenter from "@/components/NotificationCenter";
import RequireAuth from "@/components/RequireAuth";
import RitualsSection from "@/components/RitualsSection";
import { getSettings, type Settings } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { applyTheme } from "@/lib/theme";

/** Whole days the couple has been together, or null if no start date set. */
function daysTogether(startDate: string | null): number | null {
  if (!startDate) return null;
  const start = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  const ms = Date.now() - start.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function Dashboard() {
  const { token, me, logout } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    if (!token) return;
    getSettings(token)
      .then((s) => {
        setSettings(s);
        applyTheme(s.user.theme);
      })
      .catch(() => {
        /* dashboard still works without settings; modules default to visible */
      });
  }, [token]);

  // Default everything visible until settings load (or for solo users, who
  // have no couple-level module preferences).
  const mod = settings?.couple;
  const showCheckins = mod?.show_checkins ?? true;
  const showVisits = mod?.show_visits ?? true;
  const showRituals = mod?.show_rituals ?? true;
  const together = daysTogether(settings?.couple?.relationship_start_date ?? null);

  return (
    <main>
      <div className="topbar">
        <h1>Hi {me?.display_name} 👋</h1>
        <div className="row">
          <NotificationCenter />
          <Link href="/app/settings" className="link">
            Settings
          </Link>
        </div>
      </div>
      <p className="muted">
        Your shared space for staying close across the distance.
      </p>
      {together !== null && (
        <p className="muted">
          💞 Together for <strong>{together.toLocaleString()}</strong> days
        </p>
      )}
      <CoupleOnboarding />
      {/* Check-ins work solo or paired, so they're available unless hidden. */}
      {showCheckins && <CheckInCard />}
      {/* The countdown is couple-scoped, so only show it once paired up. */}
      {me?.couple && showVisits && <NextVisitWidget />}
      {/* Rituals are couple-scoped too. */}
      {me?.couple && showRituals && <RitualsSection />}
      {/* Bucket list is couple-scoped too. */}
      {me?.couple && <BucketListSection />}
      {/* Letters and the memory timeline are couple-scoped. */}
      {me?.couple && <LettersSection />}
      {me?.couple && <MemoriesTimeline />}
      <button type="button" onClick={logout}>
        Sign out
      </button>
    </main>
  );
}

export default function AppPage() {
  return (
    <RequireAuth returnTo="/app">
      <Dashboard />
    </RequireAuth>
  );
}
