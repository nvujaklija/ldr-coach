"use client";

import { useEffect, useState } from "react";
import {
  getCheckIns,
  submitTodayCheckIn,
  type CheckInList,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Status = "loading" | "ready" | "saving" | "saved" | "error";

// 1..5 scales with a glyph + label so the control stays accessible.
const MOOD_SCALE = [
  { value: 1, emoji: "😞", label: "Very low" },
  { value: 2, emoji: "😕", label: "Low" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "😄", label: "Great" },
];

const CONNECTION_SCALE = [
  { value: 1, emoji: "💔", label: "Distant" },
  { value: 2, emoji: "🙁", label: "Strained" },
  { value: 3, emoji: "😐", label: "Neutral" },
  { value: 4, emoji: "💞", label: "Close" },
  { value: 5, emoji: "❤️", label: "Connected" },
];

const TAG_PRESETS = ["tired", "stressed", "happy", "missing-you", "grateful"];

function Scale({
  legend,
  scale,
  value,
  onChange,
}: {
  legend: string;
  scale: { value: number; emoji: string; label: string }[];
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <fieldset className="scale">
      <legend>{legend}</legend>
      <div role="radiogroup" aria-label={legend} className="row">
        {scale.map((step) => (
          <button
            key={step.value}
            type="button"
            role="radio"
            aria-checked={value === step.value}
            aria-label={`${step.label} (${step.value} of 5)`}
            title={step.label}
            className={value === step.value ? "chip selected" : "chip"}
            onClick={() => onChange(step.value)}
          >
            <span aria-hidden="true">{step.emoji}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function CheckInCard() {
  const { token } = useAuth();
  const [status, setStatus] = useState<Status>("loading");
  const [recent, setRecent] = useState<CheckInList | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [connection, setConnection] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState("");

  async function loadRecent(value: string) {
    try {
      setRecent(await getCheckIns(value, 7));
      setStatus((s) => (s === "loading" ? "ready" : s));
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    if (!token) return;
    let active = true;
    getCheckIns(token, 7)
      .then((list) => {
        if (!active) return;
        setRecent(list);
        setStatus("ready");
      })
      .catch(() => active && setStatus("error"));
    return () => {
      active = false;
    };
  }, [token]);

  function toggleTag(tag: string) {
    setTags((cur) =>
      cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || mood === null || connection === null) return;
    setStatus("saving");
    try {
      await submitTodayCheckIn(token, {
        mood_score: mood,
        connection_score: connection,
        tags,
        note: note.trim() || null,
      });
      setStatus("saved");
      await loadRecent(token);
    } catch {
      setStatus("error");
    }
  }

  const averages = recent?.averages;
  const canSubmit = mood !== null && connection !== null && status !== "saving";

  return (
    <section className="card" aria-labelledby="checkin-heading">
      <h2 id="checkin-heading">Today&rsquo;s check-in</h2>

      <form onSubmit={handleSubmit} className="stack">
        <Scale legend="Mood" scale={MOOD_SCALE} value={mood} onChange={setMood} />
        <Scale
          legend="Connection"
          scale={CONNECTION_SCALE}
          value={connection}
          onChange={setConnection}
        />

        <fieldset className="scale">
          <legend>Tags</legend>
          <div className="row">
            {TAG_PRESETS.map((tag) => (
              <button
                key={tag}
                type="button"
                aria-pressed={tags.includes(tag)}
                className={tags.includes(tag) ? "chip selected" : "chip"}
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </fieldset>

        <label>
          Note (optional)
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Anything you want to share?"
          />
        </label>

        <button type="submit" disabled={!canSubmit}>
          {status === "saving" ? "Saving…" : "Save check-in"}
        </button>

        <p role="status" aria-live="polite" className="muted">
          {status === "saved" && "Check-in saved."}
          {status === "error" && "Something went wrong — please try again."}
        </p>
      </form>

      {averages && averages.count > 0 ? (
        <p className="muted" data-testid="averages">
          Last 7 days · mood {averages.mood_score?.toFixed(1)} · connection{" "}
          {averages.connection_score?.toFixed(1)} ({averages.count} check-in
          {averages.count === 1 ? "" : "s"})
        </p>
      ) : (
        <p className="muted">
          No check-ins yet this week — yours will start the trend.
        </p>
      )}
    </section>
  );
}
