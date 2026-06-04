"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  createMilestone,
  listMilestones,
  updateMilestone,
  type Milestone,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

/** Checklist of milestones for one visit, with create + done toggle. */
export default function MilestoneList({ visitId }: { visitId: string }) {
  const { token } = useAuth();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!token) return;
    listMilestones(token, visitId)
      .then(setMilestones)
      .catch(() => setError("Could not load milestones"));
  }, [token, visitId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function addMilestone(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || !token) return;
    setError(null);
    try {
      const created = await createMilestone(token, trimmed, visitId);
      setMilestones((prev) => [...prev, created]);
      setTitle("");
    } catch {
      setError("Could not add milestone");
    }
  }

  async function toggle(m: Milestone) {
    if (!token) return;
    const next = m.status === "done" ? "todo" : "done";
    try {
      const updated = await updateMilestone(token, m.id, { status: next });
      setMilestones((prev) => prev.map((x) => (x.id === m.id ? updated : x)));
    } catch {
      setError("Could not update milestone");
    }
  }

  return (
    <section>
      <h3>Milestones</h3>

      {milestones.length === 0 ? (
        <p className="muted">No milestones yet — add the first thing to plan.</p>
      ) : (
        <ul className="milestones">
          {milestones.map((m) => (
            <li key={m.id} className={m.status === "done" ? "done" : undefined}>
              <input
                type="checkbox"
                checked={m.status === "done"}
                onChange={() => toggle(m)}
                aria-label={`Mark "${m.title}" ${m.status === "done" ? "todo" : "done"}`}
              />
              <span className="title">{m.title}</span>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={addMilestone} className="row" style={{ marginTop: "1rem" }}>
        <label style={{ flex: 1 }}>
          New milestone
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. book flights"
          />
        </label>
        <button type="submit">Add</button>
      </form>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
