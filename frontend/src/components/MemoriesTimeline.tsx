"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  createMemory,
  listMemories,
  type MemoryItem,
  type MemoryType,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

const PAGE_SIZE = 20;

const TYPE_ICON: Record<MemoryType, string> = {
  photo: "📷",
  note: "📝",
  ritual: "🔁",
  visit: "✈️",
};

function memoryTitle(m: MemoryItem): string {
  if (typeof m.data.title === "string" && m.data.title) return m.data.title;
  return m.type.charAt(0).toUpperCase() + m.type.slice(1);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  try {
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return d.toLocaleDateString();
  }
}

/** The couple's shared memory timeline, newest first, with manual add. */
export default function MemoriesTimeline() {
  const { token } = useAuth();
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add-memory form state.
  const [type, setType] = useState<MemoryType>("note");
  const [title, setTitle] = useState("");

  const loadPage = useCallback(
    async (offset: number) => {
      if (!token) return;
      try {
        const page = await listMemories(token, PAGE_SIZE, offset);
        setMemories((prev) => (offset === 0 ? page : [...prev, ...page]));
        setHasMore(page.length === PAGE_SIZE);
      } catch {
        setError("Could not load memories");
      }
    },
    [token],
  );

  useEffect(() => {
    loadPage(0);
  }, [loadPage]);

  async function add(e: FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t || !token) return;
    setError(null);
    try {
      const created = await createMemory(token, type, { title: t });
      setMemories((prev) => [created, ...prev]);
      setTitle("");
    } catch {
      setError("Could not add memory");
    }
  }

  return (
    <section>
      <h3>Memories</h3>
      <p className="muted">Moments you&apos;ve shared, newest first.</p>

      {memories.length === 0 ? (
        <p className="muted">No memories yet — your shared moments will appear here.</p>
      ) : (
        <ol className="timeline">
          {memories.map((m) => (
            <li key={m.id}>
              <span aria-hidden="true">{TYPE_ICON[m.type]}</span>{" "}
              <span className="title">{memoryTitle(m)}</span>{" "}
              <time className="muted" dateTime={m.created_at}>
                {formatDate(m.created_at)}
              </time>
            </li>
          ))}
        </ol>
      )}

      {hasMore && (
        <button type="button" onClick={() => loadPage(memories.length)}>
          Load more
        </button>
      )}

      <form onSubmit={add} style={{ marginTop: "1rem" }}>
        <label>
          Kind
          <select value={type} onChange={(e) => setType(e.target.value as MemoryType)}>
            <option value="note">Note</option>
            <option value="photo">Photo</option>
          </select>
        </label>

        <label>
          Title
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Our first video date"
          />
        </label>

        <button type="submit">Add memory</button>
      </form>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
