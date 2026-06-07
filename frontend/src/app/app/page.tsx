"use client";

import CheckInCard from "@/components/CheckInCard";
import CoupleOnboarding from "@/components/CoupleOnboarding";
import NextVisitWidget from "@/components/NextVisitWidget";
import RequireAuth from "@/components/RequireAuth";
import RitualsSection from "@/components/RitualsSection";
import { useAuth } from "@/lib/auth";

function Dashboard() {
  const { me, logout } = useAuth();
  return (
    <main>
      <p className="muted" style={{ letterSpacing: "0.22em", textTransform: "uppercase", fontSize: "0.75rem" }}>
        Your shared sky
      </p>
      <h1>
        Hi <em>{me?.display_name}</em>
      </h1>
      <p className="muted">
        Your shared space for staying close across the distance.
      </p>
      <CoupleOnboarding />
      {/* Check-ins work solo or paired, so they're always available. */}
      <CheckInCard />
      {/* The countdown is couple-scoped, so only show it once paired up. */}
      {me?.couple && <NextVisitWidget />}
      {/* Rituals are couple-scoped too. */}
      {me?.couple && <RitualsSection />}
      <button type="button" className="ghost" onClick={logout}>
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
