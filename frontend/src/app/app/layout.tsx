"use client";

import AppShell from "@/components/AppShell";
import RequireAuth from "@/components/RequireAuth";

/**
 * Authenticated area layout. Guards every /app/* route once and frames them
 * with the persistent navigation shell.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireAuth returnTo="/app">
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}
