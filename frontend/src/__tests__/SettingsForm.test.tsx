import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import SettingsForm from "@/components/SettingsForm";
import * as api from "@/lib/api";
import type { Settings } from "@/lib/api";

vi.mock("@/lib/api");
const refresh = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ token: "test-token", refresh }),
}));
const mockedApi = vi.mocked(api);

function makeSettings(over: Partial<Settings> = {}): Settings {
  return {
    user: {
      timezone: "UTC",
      theme: "system",
      notify_checkin_reminders: true,
      notify_visit_reminders: true,
      notify_ritual_reminders: true,
    },
    couple: {
      relationship_start_date: "2020-02-14",
      show_visits: true,
      show_rituals: true,
      show_checkins: true,
    },
    ...over,
  };
}

describe("SettingsForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads settings and saves edited user + couple preferences", async () => {
    mockedApi.getSettings.mockResolvedValue(makeSettings());
    mockedApi.updateSettings.mockResolvedValue(
      makeSettings({
        user: {
          timezone: "Europe/Rome",
          theme: "dark",
          notify_checkin_reminders: true,
          notify_visit_reminders: false,
          notify_ritual_reminders: true,
        },
      }),
    );

    render(<SettingsForm />);
    await waitFor(() => expect(screen.getByText("Your preferences")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Timezone"), {
      target: { value: "Europe/Rome" },
    });
    fireEvent.change(screen.getByLabelText("Theme"), { target: { value: "dark" } });
    fireEvent.click(screen.getByLabelText("Visit reminders"));
    fireEvent.click(screen.getByLabelText("Rituals"));

    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() => expect(screen.getByText("Saved ✓")).toBeInTheDocument());
    expect(mockedApi.updateSettings).toHaveBeenCalledWith("test-token", {
      user: expect.objectContaining({
        timezone: "Europe/Rome",
        theme: "dark",
        notify_visit_reminders: false,
      }),
      couple: expect.objectContaining({ show_rituals: false }),
    });
    expect(refresh).toHaveBeenCalled();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("hides the relationship section for a solo user", async () => {
    mockedApi.getSettings.mockResolvedValue(makeSettings({ couple: null }));
    render(<SettingsForm />);
    await waitFor(() => expect(screen.getByText("Your preferences")).toBeInTheDocument());
    expect(screen.queryByText("Your relationship")).not.toBeInTheDocument();
  });

  it("shows an error when settings fail to load", async () => {
    mockedApi.getSettings.mockRejectedValue(new Error("boom"));
    render(<SettingsForm />);
    await waitFor(() =>
      expect(screen.getByText(/Could not load settings/i)).toBeInTheDocument(),
    );
  });
});
