"use client";

import CoupleOnboarding from "@/components/CoupleOnboarding";
import RequireAuth from "@/components/RequireAuth";
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
