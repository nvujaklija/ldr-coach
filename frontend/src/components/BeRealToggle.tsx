"use client";

import { useEffect, useState } from "react";
import { disableBeReal, enableBeReal, getBeRealStatus } from "@/lib/api";
import { useAuth } from "@/lib/auth";

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** On/off switch for the couple's BeReal moments, shown in Settings. */
export default function BeRealToggle() {
  const { token } = useAuth();
  const [active, setActive] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    getBeRealStatus(token)
      .then((s) => setActive(s.is_active))
      .catch(() => setError("Could not load BeReal settings"));
  }, [token]);

  async function toggle() {
    if (!token || active === null) return;
    setBusy(true);
    setError(null);
    try {
      const status = active
        ? await disableBeReal(token)
        : await enableBeReal(token, browserTimezone());
      setActive(status.is_active);
    } catch {
      setError("Could not update BeReal");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h3>BeReal moments</h3>
      <p className="muted">
        A surprise daily prompt to snap a photo at the same time as your partner —
        always within both of your daytime hours.
      </p>
      <button type="button" onClick={toggle} disabled={active === null || busy}>
        {active === null
          ? "Loading…"
          : busy
            ? "Saving…"
            : active
              ? "Turn off BeReal"
              : "Turn on BeReal"}
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
