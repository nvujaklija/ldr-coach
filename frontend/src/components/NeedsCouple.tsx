"use client";

import EmptyState from "@/components/EmptyState";
import { useAuth } from "@/lib/auth";

/**
 * Gate for couple-scoped screens. Shows a gentle prompt to pair up first,
 * otherwise renders the feature.
 */
export default function NeedsCouple({
  children,
}: {
  children: React.ReactNode;
}) {
  const { me } = useAuth();
  if (!me?.couple) {
    return (
      <EmptyState
        icon="🔗"
        title="Pair up first"
        action={{ href: "/app/settings", label: "Set up your couple" }}
      >
        This is a shared space for the two of you. Create your couple or join
        with an invite code to unlock it.
      </EmptyState>
    );
  }
  return <>{children}</>;
}
