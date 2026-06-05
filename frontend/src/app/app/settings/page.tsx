"use client";

import PageHeader from "@/components/PageHeader";
import SettingsForm from "@/components/SettingsForm";
import { useAuth } from "@/lib/auth";

export default function SettingsPage() {
  const { logout } = useAuth();
  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Tune your preferences and what shows on your dashboard."
      />
      <SettingsForm />
      <div className="card">
        <h2>Account</h2>
        <button type="button" className="ghost" onClick={logout}>
          Sign out
        </button>
      </div>
    </>
  );
}
