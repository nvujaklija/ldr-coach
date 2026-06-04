"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  createVisit,
  getNextVisit,
  updateVisit,
  type Visit,
  type VisitInput,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import MilestoneList from "@/components/MilestoneList";

function countdownLabel(days: number | null): string {
  if (days === null) return "";
  if (days < 0) return "Happening now or just passed 🎉";
  if (days === 0) return "Today! ✈️";
  return days === 1 ? "1 day to go" : `${days} days to go`;
}

/** Visit form used for both creating and editing the next visit. */
function VisitForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Visit;
  submitLabel: string;
  onSubmit: (input: VisitInput) => Promise<void>;
}) {
  const [location, setLocation] = useState(initial?.location ?? "");
  const [startDate, setStartDate] = useState(initial?.start_date ?? "");
  const [endDate, setEndDate] = useState(initial?.end_date ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onSubmit({
        location: location.trim(),
        start_date: startDate,
        end_date: endDate || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save visit");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="stack">
      <label>
        Where
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Lisbon"
          required
        />
      </label>
      <label>
        Arrives
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          required
        />
      </label>
      <label>
        Leaves (optional)
        <input
          type="date"
          value={endDate ?? ""}
          onChange={(e) => setEndDate(e.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy}>
        {busy ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}

export default function NextVisitWidget() {
  const { token } = useAuth();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!token) return;
    getNextVisit(token)
      .then(setVisit)
      .finally(() => setLoading(false));
  }, [token]);

  if (loading || !token) {
    return (
      <p role="status" className="muted">
        Loading your next visit…
      </p>
    );
  }

  // No active visit — show the create form.
  if (visit === null) {
    return (
      <section className="card">
        <h2>Plan your next visit</h2>
        <p className="muted">
          Nothing on the calendar yet. Add your next trip to start the countdown.
        </p>
        <VisitForm
          submitLabel="Start the countdown"
          onSubmit={async (input) => {
            setVisit(await createVisit(token, input));
          }}
        />
      </section>
    );
  }

  // Editing the active visit.
  if (editing) {
    return (
      <section className="card">
        <h2>Edit next visit</h2>
        <VisitForm
          initial={visit}
          submitLabel="Save changes"
          onSubmit={async (input) => {
            setVisit(await updateVisit(token, visit.id, input));
            setEditing(false);
          }}
        />
        <button type="button" className="ghost" onClick={() => setEditing(false)}>
          Cancel
        </button>
      </section>
    );
  }

  // Active visit — countdown + details + milestones.
  return (
    <section className="card">
      <div className="topbar">
        <h2>Next visit</h2>
        <div className="row">
          <button type="button" className="ghost" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button
            type="button"
            className="ghost"
            onClick={async () => {
              await updateVisit(token, visit.id, { status: "completed" });
              setVisit(null);
            }}
          >
            Mark visited
          </button>
        </div>
      </div>

      <p className="countdown" data-testid="countdown">
        {visit.days_until ?? "—"}
      </p>
      <p className="muted">{countdownLabel(visit.days_until)}</p>

      <p>
        <strong>{visit.location}</strong>
        <br />
        <span className="muted">
          {visit.start_date}
          {visit.end_date ? ` → ${visit.end_date}` : ""}
        </span>
      </p>

      <MilestoneList visitId={visit.id} />
    </section>
  );
}
