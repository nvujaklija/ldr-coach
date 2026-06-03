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
