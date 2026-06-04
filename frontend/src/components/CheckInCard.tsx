"use client";

import { useEffect, useState } from "react";
import {
  CheckInList,
  NotAuthenticatedError,
  getCheckIns,
  submitTodayCheckIn,
} from "@/lib/api";

type Status = "loading" | "ready" | "saving" | "saved" | "error" | "unauthenticated";

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
    <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
      <legend>{legend}</legend>
      <div role="radiogroup" aria-label={legend} style={{ display: "flex", gap: 8 }}>
        {scale.map((step) => (
          <button
            key={step.value}
            type="button"
            role="radio"
            aria-checked={value === step.value}
            aria-label={`${step.label} (${step.value} of 5)`}
            title={step.label}
            onClick={() => onChange(step.value)}
            style={{
              fontSize: "1.5rem",
              padding: "4px 8px",
              cursor: "pointer",
              borderRadius: 8,
              border:
                value === step.value ? "2px solid #4f46e5" : "1px solid #ccc",
              background: value === step.value ? "#eef2ff" : "transparent",
            }}
          >
            <span aria-hidden="true">{step.emoji}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function CheckInCard() {
  const [status, setStatus] = useState<Status>("loading");
  const [recent, setRecent] = useState<CheckInList | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [connection, setConnection] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState("");

  async function loadRecent() {
    try {
      setRecent(await getCheckIns(7));
      setStatus((s) => (s === "loading" ? "ready" : s));
    } catch (err) {
      if (err instanceof NotAuthenticatedError) {
        setStatus("unauthenticated");
      } else {
        setStatus("error");
      }
    }
  }

  useEffect(() => {
    let active = true;
    getCheckIns(7)
      .then((list) => active && (setRecent(list), setStatus("ready")))
      .catch((err) => {
        if (!active) return;
        setStatus(err instanceof NotAuthenticatedError ? "unauthenticated" : "error");
      });
    return () => {
      active = false;
    };
  }, []);

  function toggleTag(tag: string) {
    setTags((cur) =>
      cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mood === null || connection === null) return;
    setStatus("saving");
    try {
      await submitTodayCheckIn({
        mood_score: mood,
        connection_score: connection,
        tags,
        note: note.trim() || null,
      });
      setStatus("saved");
      await loadRecent();
    } catch (err) {
      setStatus(err instanceof NotAuthenticatedError ? "unauthenticated" : "error");
    }
  }

  if (status === "unauthenticated") {
    return (
      <section aria-labelledby="checkin-heading">
        <h2 id="checkin-heading">Today&rsquo;s check-in</h2>
        <p>Sign in to record how you&rsquo;re feeling today.</p>
      </section>
    );
  }

  const averages = recent?.averages;
  const canSubmit = mood !== null && connection !== null && status !== "saving";

  return (
    <section aria-labelledby="checkin-heading">
      <h2 id="checkin-heading">Today&rsquo;s check-in</h2>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16, maxWidth: 420 }}>
        <Scale legend="Mood" scale={MOOD_SCALE} value={mood} onChange={setMood} />
        <Scale
          legend="Connection"
          scale={CONNECTION_SCALE}
          value={connection}
          onChange={setConnection}
        />

        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
          <legend>Tags</legend>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {TAG_PRESETS.map((tag) => (
              <button
                key={tag}
                type="button"
                aria-pressed={tags.includes(tag)}
                onClick={() => toggleTag(tag)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 999,
                  cursor: "pointer",
                  border: tags.includes(tag)
                    ? "1px solid #4f46e5"
                    : "1px solid #ccc",
                  background: tags.includes(tag) ? "#eef2ff" : "transparent",
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        </fieldset>

        <label style={{ display: "grid", gap: 4 }}>
          <span>Note (optional)</span>
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

        <p role="status" aria-live="polite">
          {status === "saved" && "Check-in saved."}
          {status === "error" && "Something went wrong — please try again."}
        </p>
      </form>

      {averages && averages.count > 0 ? (
        <p data-testid="averages">
          Last 7 days · mood {averages.mood_score?.toFixed(1)} · connection{" "}
          {averages.connection_score?.toFixed(1)} ({averages.count} check-in
          {averages.count === 1 ? "" : "s"})
        </p>
      ) : (
        <p>No check-ins yet this week — yours will start the trend.</p>
      )}
    </section>
  );
}
