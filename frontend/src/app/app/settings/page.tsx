"use client";

import RequireAuth from "@/components/RequireAuth";
import SettingsForm from "@/components/SettingsForm";

function Settings() {
  return (
    <main>
      <h1>Settings</h1>
      <p className="muted">Tune your preferences and what shows on your dashboard.</p>
      <SettingsForm />
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
