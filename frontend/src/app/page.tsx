"use client";

import Link from "next/link";
import BackendStatus from "@/components/BackendStatus";
import { useAuth } from "@/lib/auth";

export default function HomePage() {
  const { token, loading } = useAuth();
  return (
    <main>
      <p className="muted" style={{ letterSpacing: "0.22em", textTransform: "uppercase", fontSize: "0.75rem" }}>
        One sky · two time zones
      </p>
      <h1>
        Stay close,
        <br />
        <em>across the distance.</em>
      </h1>
      <p style={{ fontSize: "1.1rem", maxWidth: "46ch" }}>
        LDR Coach is your shared space for the miles in between — count down to
        the next visit, check in on each other daily, and keep your rituals
        alive no matter the time zone.
      </p>
      <p style={{ marginTop: "1.75rem" }}>
        {loading ? null : token ? (
          <Link href="/app">Go to your dashboard →</Link>
        ) : (
          <>
            <Link href="/register">Get started</Link>
            &nbsp;&nbsp;·&nbsp;&nbsp;
            <Link href="/login">Sign in</Link>
          </>
        )}
      </p>
      <div style={{ marginTop: "2.5rem" }}>
        <BackendStatus />
      </div>
    </main>
  );
}
