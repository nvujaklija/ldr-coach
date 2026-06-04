import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import NotificationCenter from "@/components/NotificationCenter";
import * as api from "@/lib/api";
import type { AppNotification, NotificationPreferences } from "@/lib/api";

vi.mock("@/lib/api");
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ token: "test-token" }),
}));
const mockedApi = vi.mocked(api);

function makeNotification(over: Partial<AppNotification> = {}): AppNotification {
  return {
    id: "n1",
    type: "visit_reminder",
    title: "Visit in 3 days",
    body: "Your visit to Rome is on 2026-06-20.",
    payload: {},
    trigger_at: "2026-06-04T09:00:00Z",
    read_at: null,
    created_at: "2026-06-04T09:00:00Z",
    ...over,
  };
}

const PREFS: NotificationPreferences = {
  visit_reminder_days: 3,
  visit_reminders_enabled: true,
  ritual_reminders_enabled: true,
  in_app_enabled: true,
  email_enabled: false,
};

describe("NotificationCenter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.getNotificationPreferences.mockResolvedValue(PREFS);
  });

  it("shows an unread badge from the unread count", async () => {
    mockedApi.listNotifications.mockResolvedValue({
      notifications: [makeNotification()],
      unread_count: 1,
    });
    render(<NotificationCenter />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /1 unread/i })).toBeInTheDocument(),
    );
  });

  it("opens the panel and lists notifications", async () => {
    mockedApi.listNotifications.mockResolvedValue({
      notifications: [makeNotification()],
      unread_count: 1,
    });
    render(<NotificationCenter />);
    await waitFor(() => screen.getByRole("button", { name: /unread/i }));

    fireEvent.click(screen.getByRole("button", { name: /Notifications/i }));
    expect(await screen.findByText("Visit in 3 days")).toBeInTheDocument();
  });

  it("marks a single notification read on click", async () => {
    mockedApi.listNotifications.mockResolvedValue({
      notifications: [makeNotification()],
      unread_count: 1,
    });
    mockedApi.markNotificationRead.mockResolvedValue(
      makeNotification({ read_at: "2026-06-04T10:00:00Z" }),
    );
    render(<NotificationCenter />);
    await waitFor(() => screen.getByRole("button", { name: /unread/i }));

    fireEvent.click(screen.getByRole("button", { name: /Notifications/i }));
    fireEvent.click(await screen.findByText("Visit in 3 days"));

    await waitFor(() =>
      expect(mockedApi.markNotificationRead).toHaveBeenCalledWith("test-token", "n1"),
    );
  });

  it("marks all notifications read", async () => {
    mockedApi.listNotifications.mockResolvedValue({
      notifications: [makeNotification()],
      unread_count: 1,
    });
    mockedApi.markAllNotificationsRead.mockResolvedValue({
      notifications: [makeNotification({ read_at: "2026-06-04T10:00:00Z" })],
      unread_count: 0,
    });
    render(<NotificationCenter />);
    await waitFor(() => screen.getByRole("button", { name: /unread/i }));

    fireEvent.click(screen.getByRole("button", { name: /Notifications/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Mark all read/i }));

    await waitFor(() =>
      expect(mockedApi.markAllNotificationsRead).toHaveBeenCalledWith("test-token"),
    );
  });

  it("shows an empty state when there are no notifications", async () => {
    mockedApi.listNotifications.mockResolvedValue({ notifications: [], unread_count: 0 });
    render(<NotificationCenter />);
    await waitFor(() => screen.getByRole("button", { name: /Notifications/i }));

    fireEvent.click(screen.getByRole("button", { name: /Notifications/i }));
    expect(await screen.findByText(/caught up/i)).toBeInTheDocument();
  });
});
