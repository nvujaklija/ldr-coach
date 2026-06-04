"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

/**
 * Client-side route guard. Renders children only for an authenticated user;
 * otherwise redirects to /login, preserving where the user was headed.
 */
export default function RequireAuth({
  children,
  returnTo,
}: {
  children: React.ReactNode;
  returnTo?: string;
}) {
  const { token, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !token) {
      const next = returnTo ? `?next=${encodeURIComponent(returnTo)}` : "";
      router.replace(`/login${next}`);
    }
  }, [loading, token, router, returnTo]);

  if (loading) {
    return <p role="status">Loading…</p>;
  }
  if (!token) {
    return null;
  }
  return <>{children}</>;
}
