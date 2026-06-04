"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getNotificationPreferences,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
  type AppNotification,
  type NotificationPreferences,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

// How often to poll the backend for newly-due notifications.
const POLL_MS = 30_000;
// How long a toast stays on screen.
const TOAST_MS = 6_000;

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMin = Math.round((Date.now() - then) / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return new Date(iso).toLocaleDateString();
}

/** Bell + dropdown notification center, with toasts for newly-arrived items. */
export default function NotificationCenter() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<AppNotification | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [showPrefs, setShowPrefs] = useState(false);

  // Remember which unread ids we've already surfaced so polling only toasts
  // genuinely new ones. Seeded on the first load so existing items stay quiet.
  const seen = useRef<Set<string>>(new Set());
  const initialized = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(() => {
    if (!token) return;
    listNotifications(token)
      .then((data) => {
        setNotifications(data.notifications);
        setUnread(data.unread_count);

        const fresh = data.notifications.filter(
          (n) => !n.read_at && !seen.current.has(n.id),
        );
        data.notifications.forEach((n) => seen.current.add(n.id));

        // Don't toast the backlog present on first load.
        if (initialized.current && fresh.length > 0) {
          setToast(fresh[0]);
          if (toastTimer.current) clearTimeout(toastTimer.current);
          toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
        }
        initialized.current = true;
      })
      .catch(() => {
        /* transient; the next poll will retry */
      });
  }, [token]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => {
      clearInterval(id);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [refresh]);

  function openPanel() {
    const next = !open;
    setOpen(next);
    if (next && token && !prefs) {
      getNotificationPreferences(token)
        .then(setPrefs)
        .catch(() => {
          /* prefs are optional UI; ignore load failures */
        });
    }
  }

  async function onMarkRead(n: AppNotification) {
    if (!token || n.read_at) return;
    try {
      await markNotificationRead(token, n.id);
      setNotifications((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)),
      );
      setUnread((u) => Math.max(0, u - 1));
    } catch {
      /* ignore; a later poll will reconcile */
    }
  }

  async function onMarkAll() {
    if (!token) return;
    try {
      const data = await markAllNotificationsRead(token);
      setNotifications((prev) => prev.map((x) => ({ ...x, read_at: x.read_at ?? "read" })));
      setUnread(data.unread_count);
    } catch {
      /* ignore */
    }
  }

  async function togglePref(key: keyof NotificationPreferences, value: boolean | number) {
    if (!token || !prefs) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    try {
      const saved = await updateNotificationPreferences(token, { [key]: value });
      setPrefs(saved);
    } catch {
      setPrefs(prefs); // revert on failure
    }
  }

  return (
    <div className="notif">
      <button
        type="button"
        className="ghost notif-bell"
        onClick={openPanel}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        aria-expanded={open}
      >
        🔔
        {unread > 0 && <span className="notif-badge">{unread}</span>}
      </button>

      {open && (
        <div className="notif-panel" role="dialog" aria-label="Notifications">
          <div className="notif-head">
            <strong>Notifications</strong>
            {unread > 0 && (
              <button type="button" className="link" onClick={onMarkAll}>
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="muted">You&apos;re all caught up.</p>
          ) : (
            <ul className="notif-list">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={n.read_at ? "read" : "unread"}
                  onClick={() => onMarkRead(n)}
                >
                  <span className="title">{n.title}</span>
                  {n.body && <span className="muted body">{n.body}</span>}
                  <span className="muted time">{relativeTime(n.created_at)}</span>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            className="link notif-prefs-toggle"
            onClick={() => setShowPrefs((s) => !s)}
          >
            {showPrefs ? "Hide" : "Reminder settings"}
          </button>

          {showPrefs && prefs && (
            <div className="notif-prefs">
              <label className="row-inline">
                <input
                  type="checkbox"
                  checked={prefs.visit_reminders_enabled}
                  onChange={(e) => togglePref("visit_reminders_enabled", e.target.checked)}
                />
                Visit reminders
              </label>
              <label className="row-inline">
                Days before
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={prefs.visit_reminder_days}
                  onChange={(e) =>
                    togglePref("visit_reminder_days", Number(e.target.value))
                  }
                />
              </label>
              <label className="row-inline">
                <input
                  type="checkbox"
                  checked={prefs.ritual_reminders_enabled}
                  onChange={(e) => togglePref("ritual_reminders_enabled", e.target.checked)}
                />
                Ritual reminders
              </label>
            </div>
          )}
        </div>
      )}

      {toast && (
        <div className="notif-toast" role="status" onClick={() => setToast(null)}>
          <strong>{toast.title}</strong>
          {toast.body && <span className="muted">{toast.body}</span>}
        </div>
      )}
    </div>
  );
}
