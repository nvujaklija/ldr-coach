"use client";

import BucketListSection from "@/components/BucketListSection";
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
      <h1>Hi {me?.display_name} 👋</h1>
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
      {/* Bucket list is couple-scoped too. */}
      {me?.couple && <BucketListSection />}
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
