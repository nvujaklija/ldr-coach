"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";

/**
 * Gates its children behind authentication. While the session resolves it
 * shows a loading state; if there's no user it redirects to /login.
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user === null) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || user === null) {
    return <p role="status">Loading…</p>;
  }

  return <>{children}</>;
}
