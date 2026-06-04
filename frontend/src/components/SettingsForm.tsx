"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import {
  getSettings,
  updateSettings,
  type CoupleSettings,
  type Settings,
  type Theme,
  type UserSettings,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { applyTheme } from "@/lib/theme";

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Edit per-user preferences and shared couple settings. */
export default function SettingsForm() {
  const { token, refresh } = useAuth();
  const [user, setUser] = useState<UserSettings | null>(null);
  const [couple, setCouple] = useState<CoupleSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    getSettings(token)
      .then((s: Settings) => {
        setUser(s.user);
        setCouple(s.couple);
        applyTheme(s.user.theme);
      })
      .catch(() => setError("Could not load settings"))
      .finally(() => setLoading(false));
  }, [token]);

  function patchUser<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
    setUser((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
    if (key === "theme") applyTheme(value as Theme);
  }

  function patchCouple<K extends keyof CoupleSettings>(key: K, value: CoupleSettings[K]) {
    setCouple((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!token || !user) return;
    setSaving(true);
    setError(null);
    try {
      const result = await updateSettings(token, {
        user,
        couple: couple ?? undefined,
      });
      setUser(result.user);
      setCouple(result.couple);
      applyTheme(result.user.theme);
      setSaved(true);
      // Module visibility / start date affect the dashboard, so refresh
      // the cached profile other pages read from.
      await refresh();
    } catch {
      setError("Could not save settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="muted">Loading settings…</p>;
  if (!user) {
    return (
      <p role="alert" className="error">
        {error ?? "Could not load settings"}
      </p>
    );
  }

  return (
    <form onSubmit={save}>
      <section>
        <h3>Your preferences</h3>

        <label>
          Timezone
          <input
            type="text"
            value={user.timezone}
            onChange={(e) => patchUser("timezone", e.target.value)}
            placeholder={browserTimezone()}
          />
        </label>

        <label>
          Theme
          <select
            value={user.theme}
            onChange={(e) => patchUser("theme", e.target.value as Theme)}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>

        <fieldset className="scale">
          <legend>Notifications</legend>
          <label className="row">
            <input
              type="checkbox"
              checked={user.notify_checkin_reminders}
              onChange={(e) => patchUser("notify_checkin_reminders", e.target.checked)}
            />
            Daily check-in reminders
          </label>
          <label className="row">
            <input
              type="checkbox"
              checked={user.notify_visit_reminders}
              onChange={(e) => patchUser("notify_visit_reminders", e.target.checked)}
            />
            Visit reminders
          </label>
          <label className="row">
            <input
              type="checkbox"
              checked={user.notify_ritual_reminders}
              onChange={(e) => patchUser("notify_ritual_reminders", e.target.checked)}
            />
            Ritual reminders
          </label>
        </fieldset>
      </section>

      {couple && (
        <section>
          <h3>Your relationship</h3>

          <label>
            Together since
            <input
              type="date"
              value={couple.relationship_start_date ?? ""}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) =>
                patchCouple("relationship_start_date", e.target.value || null)
              }
            />
          </label>

          <fieldset className="scale">
            <legend>Show on your dashboard</legend>
            <label className="row">
              <input
                type="checkbox"
                checked={couple.show_checkins}
                onChange={(e) => patchCouple("show_checkins", e.target.checked)}
              />
              Daily check-ins
            </label>
            <label className="row">
              <input
                type="checkbox"
                checked={couple.show_visits}
                onChange={(e) => patchCouple("show_visits", e.target.checked)}
              />
              Visit countdown
            </label>
            <label className="row">
              <input
                type="checkbox"
                checked={couple.show_rituals}
                onChange={(e) => patchCouple("show_rituals", e.target.checked)}
              />
              Rituals
            </label>
          </fieldset>
        </section>
      )}

      <div className="row" style={{ marginTop: "1rem" }}>
        <button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </button>
        <Link href="/app" className="link">
          Back to dashboard
        </Link>
      </div>

      {saved && <p className="muted">Saved ✓</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </form>
  );
}
