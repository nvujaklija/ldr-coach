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
import Link from "next/link";
import BackendStatus from "@/components/BackendStatus";
import { useAuth } from "@/lib/auth";

export default function HomePage() {
  const { token, loading } = useAuth();
  return (
    <main>
      <h1>LDR Coach</h1>
      <p>
        Your shared space for staying close across the distance. Create an
        account, pair up with your partner, and start building rituals together.
      </p>
      <p>
        {loading ? null : token ? (
          <Link href="/app">Go to your dashboard →</Link>
        ) : (
          <>
            <Link href="/register">Get started</Link> &nbsp;·&nbsp;{" "}
            <Link href="/login">Sign in</Link>
          </>
        )}
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
