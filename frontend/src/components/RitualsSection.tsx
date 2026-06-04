"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  createRitual,
  listRitualTemplates,
  listRituals,
  updateRitual,
  updateRitualInstance,
  type Ritual,
  type RitualCadence,
  type RitualTemplate,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

// index = day_of_week the backend expects (0=Mon … 6=Sun).
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Format a UTC occurrence in the ritual's own timezone for display. */
function formatOccurrence(iso: string, tz: string | null): string {
  const d = new Date(iso);
  try {
    return d.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: tz || undefined,
    });
  } catch {
    return d.toLocaleString();
  }
}

/** Schedule + track a couple's recurring virtual dates. */
export default function RitualsSection() {
  const { token } = useAuth();
  const [templates, setTemplates] = useState<RitualTemplate[]>([]);
  const [rituals, setRituals] = useState<Ritual[]>([]);
  const [error, setError] = useState<string | null>(null);

  // New-ritual form state.
  const [templateKey, setTemplateKey] = useState("");
  const [title, setTitle] = useState("");
  const [cadence, setCadence] = useState<RitualCadence>("weekly");
  const [dayOfWeek, setDayOfWeek] = useState(4); // Friday
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [time, setTime] = useState("20:00");
  const [timezone, setTimezone] = useState(browserTimezone());

  const refresh = useCallback(() => {
    if (!token) return;
    listRituals(token)
      .then(setRituals)
      .catch(() => setError("Could not load rituals"));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    listRitualTemplates(token)
      .then(setTemplates)
      .catch(() => {
        /* templates are a nice-to-have; the custom path still works */
      });
    refresh();
  }, [token, refresh]);

  function pickTemplate(key: string) {
    setTemplateKey(key);
    const t = templates.find((x) => x.key === key);
    if (t) {
      setTitle(t.title);
      setCadence(t.default_cadence as RitualCadence);
    }
  }

  async function addRitual(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || !token) return;
    setError(null);
    try {
      const created = await createRitual(token, {
        template_key: templateKey || null,
        title: trimmed,
        cadence,
        day_of_week: cadence === "weekly" ? dayOfWeek : null,
        day_of_month: cadence === "monthly" ? dayOfMonth : null,
        time_of_day: time,
        timezone,
      });
      setRituals((prev) => [...prev, created]);
      setTitle("");
      setTemplateKey("");
    } catch {
      setError("Could not create ritual");
    }
  }

  async function markDone(r: Ritual) {
    if (!token || !r.next_instance) return;
    try {
      const updated = await updateRitualInstance(token, r.id, r.next_instance.id, "done");
      setRituals((prev) => prev.map((x) => (x.id === r.id ? updated : x)));
    } catch {
      setError("Could not update occurrence");
    }
  }

  async function cancelRitual(r: Ritual) {
    if (!token) return;
    try {
      await updateRitual(token, r.id, { status: "cancelled" });
      setRituals((prev) => prev.filter((x) => x.id !== r.id));
    } catch {
      setError("Could not cancel ritual");
    }
  }

  return (
    <section>
      <h3>Rituals</h3>
      <p className="muted">Recurring virtual dates you share across the distance.</p>

      {rituals.length === 0 ? (
        <p className="muted">No rituals yet — schedule your first shared date below.</p>
      ) : (
        <ul className="rituals">
          {rituals.map((r) => (
            <li key={r.id}>
              <span className="title">{r.title}</span>{" "}
              {r.next_instance ? (
                <span className="muted">
                  Next: {formatOccurrence(r.next_instance.scheduled_for, r.timezone)}
                </span>
              ) : (
                <span className="muted">Paused</span>
              )}{" "}
              {r.next_instance && (
                <button type="button" onClick={() => markDone(r)}>
                  Mark done
                </button>
              )}
              <button
                type="button"
                onClick={() => cancelRitual(r)}
                aria-label={`Cancel ${r.title}`}
              >
                Cancel
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={addRitual} style={{ marginTop: "1rem" }}>
        <label>
          Ritual
          <select value={templateKey} onChange={(e) => pickTemplate(e.target.value)}>
            <option value="">Custom…</option>
            {templates.map((t) => (
              <option key={t.key} value={t.key}>
                {t.icon ? `${t.icon} ` : ""}
                {t.title}
              </option>
            ))}
          </select>
        </label>

        <label>
          Title
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Movie Night"
          />
        </label>

        <label>
          Repeats
          <select
            value={cadence}
            onChange={(e) => setCadence(e.target.value as RitualCadence)}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>

        {cadence === "weekly" && (
          <label>
            Day
            <select value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))}>
              {WEEKDAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        )}

        {cadence === "monthly" && (
          <label>
            Day of month
            <input
              type="number"
              min={1}
              max={31}
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(Number(e.target.value))}
            />
          </label>
        )}

        <label>
          Time
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>

        <label>
          Timezone
          <input
            type="text"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          />
        </label>

        <button type="submit">Add ritual</button>
      </form>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
