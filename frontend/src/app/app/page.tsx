"use client";

import { useEffect, useState } from "react";
import CheckInCard from "@/components/CheckInCard";
import CoupleOnboarding from "@/components/CoupleOnboarding";
import NextVisitWidget from "@/components/NextVisitWidget";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import { getSettings, type Settings } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/** Whole days the couple has been together, or null if no start date set. */
function daysTogether(startDate: string | null): number | null {
  if (!startDate) return null;
  const start = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  const ms = Date.now() - start.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/** Home dashboard: a warm welcome, setup checklist, and today's essentials. */
export default function HomePage() {
  const { token, me } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    if (!token) return;
    getSettings(token)
      .then(setSettings)
      .catch(() => {
        /* dashboard still works without settings; modules default to visible */
      });
  }, [token]);

  const showCheckins = settings?.couple?.show_checkins ?? true;
  const showVisits = settings?.couple?.show_visits ?? true;
  const together = daysTogether(settings?.couple?.relationship_start_date ?? null);

  return (
    <>
      <header className="page-header">
        <h1>Hi <em>{me?.display_name}</em> 👋</h1>
        <p>Your shared space for staying close across the distance.</p>
        {together !== null && (
          <p className="muted">
            💞 Together for <strong>{together.toLocaleString()}</strong> days
          </p>
        )}
      </header>

      <OnboardingChecklist />

      {/* Until they've paired up, the create/join flow takes the spotlight. */}
      {!me?.couple && <CoupleOnboarding />}

      {/* Check-ins work solo or paired, so they're available unless hidden. */}
      {showCheckins && <CheckInCard />}

      {/* The countdown is couple-scoped, so only show it once paired up. */}
      {me?.couple && showVisits && <NextVisitWidget />}
    </>
  );
}
