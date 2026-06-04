"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  createBucketItem,
  getNextVisit,
  listBucketItems,
  updateBucketItem,
  type BucketItem,
  type BucketStatus,
  type Visit,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

const STATUS_GROUPS: { value: BucketStatus; label: string }[] = [
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
];

/** Shared wishlist grouped by status, with optional linking to the next trip. */
export default function BucketListSection() {
  const { token } = useAuth();
  const [items, setItems] = useState<BucketItem[]>([]);
  const [nextVisit, setNextVisit] = useState<Visit | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [linkVisit, setLinkVisit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!token) return;
    listBucketItems(token)
      .then(setItems)
      .catch(() => setError("Could not load bucket list"));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    refresh();
    getNextVisit(token)
      .then(setNextVisit)
      .catch(() => {
        /* the visit link is optional */
      });
  }, [token, refresh]);

  async function addItem(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || !token) return;
    setError(null);
    try {
      const created = await createBucketItem(token, {
        title: trimmed,
        category: category.trim() || null,
        target_visit_id: linkVisit && nextVisit ? nextVisit.id : null,
      });
      setItems((prev) => [...prev, created]);
      setTitle("");
      setCategory("");
      setLinkVisit(false);
    } catch {
      setError("Could not add item");
    }
  }

  async function setStatus(item: BucketItem, status: BucketStatus) {
    if (!token) return;
    try {
      const updated = await updateBucketItem(token, item.id, { status });
      setItems((prev) => prev.map((x) => (x.id === item.id ? updated : x)));
    } catch {
      setError("Could not update item");
    }
  }

  return (
    <section>
      <h3>Bucket List</h3>
      <p className="muted">Things to do together — someday or on your next trip.</p>

      {items.length === 0 ? (
        <p className="muted">No bucket-list items yet — add your first shared goal below.</p>
      ) : (
        STATUS_GROUPS.map((group) => {
          const groupItems = items.filter((i) => i.status === group.value);
          return (
            <div key={group.value} className="bucket-group">
              <h4>{group.label}</h4>
              {groupItems.length === 0 ? (
                <p className="muted">Nothing here yet.</p>
              ) : (
                <ul className="bucket-items">
                  {groupItems.map((i) => (
                    <li key={i.id}>
                      <span className="title">{i.title}</span>
                      {i.category && <span className="badge"> ({i.category})</span>}
                      {i.target_visit_id && (
                        <span className="muted"> · linked to next trip</span>
                      )}{" "}
                      <select
                        aria-label={`Status for ${i.title}`}
                        value={i.status}
                        onChange={(e) => setStatus(i, e.target.value as BucketStatus)}
                      >
                        {STATUS_GROUPS.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })
      )}

      <form onSubmit={addItem} style={{ marginTop: "1rem" }}>
        <label>
          New goal
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Watch the sunrise together"
          />
        </label>
        <label>
          Category
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Travel"
          />
        </label>
        {nextVisit && (
          <label>
            <input
              type="checkbox"
              checked={linkVisit}
              onChange={(e) => setLinkVisit(e.target.checked)}
            />
            Link to next trip ({nextVisit.location})
          </label>
        )}
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
