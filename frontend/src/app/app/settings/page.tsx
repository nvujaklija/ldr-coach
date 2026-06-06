"use client";

import BeRealToggle from "@/components/BeRealToggle";
import RequireAuth from "@/components/RequireAuth";

function Settings() {
  return (
    <main>
      <h1>Settings</h1>
      <p className="muted">Tune how you and your partner stay connected.</p>
      <BeRealToggle />
    </main>
  );
}

export default function SettingsPage() {
  return (
    <RequireAuth returnTo="/app/settings">
      <Settings />
    </RequireAuth>
  );
}
