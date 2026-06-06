"use client";

import Link from "next/link";
import BackendStatus from "@/components/BackendStatus";
import { useAuth } from "@/lib/auth";

export default function HomePage() {
  const { token, loading } = useAuth();
  return (
    <main>
      <h1>💕 LDR Coach</h1>
      <p>
        Your shared space for staying close across the distance. Create an
        account, pair up with your partner, and build rituals, plan visits, and
        keep a bucket list together.
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
      <BackendStatus />
    </main>
  );
}
