"use client";

import BackendStatus from "@/components/BackendStatus";
import NextVisitWidget from "@/components/NextVisitWidget";
import RequireAuth from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";

function Dashboard() {
  const { user, logout } = useAuth();
  return (
    <main>
      <div className="topbar">
        <h1>LDR Coach</h1>
        <button type="button" className="ghost" onClick={logout}>
          Sign out{user ? ` (${user.display_name})` : ""}
        </button>
      </div>
      <p className="muted">
        Your shared space for staying close across the distance.
      </p>

      <NextVisitWidget />

      <BackendStatus />
    </main>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  );
}
