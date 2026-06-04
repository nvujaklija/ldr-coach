"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  createLetter,
  listLetters,
  openLetter,
  type Letter,
  type LetterBox,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

/** Human-readable unlock date for a letter. */
function formatUnlock(iso: string): string {
  const d = new Date(iso);
  try {
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return d.toLocaleString();
  }
}

/**
 * Convert a <input type="datetime-local"> value (local wall-clock, no zone)
 * into an ISO/UTC string the API expects. Empty means "unlocked now".
 */
function localInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value); // parsed in the browser's local timezone
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Compose + read time-released letters between partners. */
export default function LettersSection() {
  const { token } = useAuth();
  const [box, setBox] = useState<LetterBox>("inbox");
  const [letters, setLetters] = useState<Letter[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Compose form state.
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [unlockAt, setUnlockAt] = useState("");

  const load = useCallback(
    (which: LetterBox) => {
      if (!token) return;
      listLetters(token, which)
        .then(setLetters)
        .catch(() => setError("Could not load letters"));
    },
    [token],
  );

  useEffect(() => {
    load(box);
  }, [box, load]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const t = title.trim();
    const b = body.trim();
    if (!t || !b || !token) return;
    setError(null);
    try {
      await createLetter(token, {
        title: t,
        body: b,
        visible_from: localInputToIso(unlockAt),
      });
      setTitle("");
      setBody("");
      setUnlockAt("");
      // Show the partner's-eye view by refreshing whichever box is open;
      // a just-sent letter appears under "Sent".
      load(box);
    } catch {
      setError("Could not send letter");
    }
  }

  async function read(letter: Letter) {
    if (!token) return;
    try {
      const opened = await openLetter(token, letter.id);
      setLetters((prev) => prev.map((l) => (l.id === opened.id ? opened : l)));
    } catch {
      setError("Could not open letter");
    }
  }

  return (
    <section>
      <h3>Letters</h3>
      <p className="muted">Write something today for your partner to open later.</p>

      <div className="row" role="tablist" aria-label="Letter box">
        <button
          type="button"
          role="tab"
          aria-selected={box === "inbox"}
          onClick={() => setBox("inbox")}
        >
          Inbox
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={box === "sent"}
          onClick={() => setBox("sent")}
        >
          Sent
        </button>
      </div>

      {letters.length === 0 ? (
        <p className="muted">
          {box === "inbox"
            ? "No letters yet — none waiting for you."
            : "You haven't written any letters yet."}
        </p>
      ) : (
        <ul className="letters">
          {letters.map((l) => (
            <li key={l.id}>
              <span className="title">{l.title}</span>{" "}
              <span className="muted">
                {l.direction === "received" ? `from ${l.from_name}` : `to ${l.to_name}`}
              </span>
              {l.is_locked ? (
                <p className="muted">🔒 Unlocks {formatUnlock(l.visible_from)}</p>
              ) : l.direction === "received" && !l.is_opened ? (
                <button type="button" onClick={() => read(l)}>
                  Read
                </button>
              ) : (
                <p>{l.body}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={send} style={{ marginTop: "1rem" }}>
        <label>
          Title
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="A note for you"
          />
        </label>

        <label>
          Message
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your letter…"
            rows={4}
          />
        </label>

        <label>
          Unlock on (optional)
          <input
            type="datetime-local"
            value={unlockAt}
            onChange={(e) => setUnlockAt(e.target.value)}
          />
        </label>

        <button type="submit">Send letter</button>
      </form>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
