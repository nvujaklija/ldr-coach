"use client";

import BeRealView from "@/components/BeRealView";
import RequireAuth from "@/components/RequireAuth";

export default function BeRealPage() {
  return (
    <RequireAuth returnTo="/app/bereal">
      <BeRealView />
    </RequireAuth>
  );
}
