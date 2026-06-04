import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import RitualsSection from "@/components/RitualsSection";
import * as api from "@/lib/api";
import type { Ritual } from "@/lib/api";

vi.mock("@/lib/api");
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ token: "test-token" }),
}));
const mockedApi = vi.mocked(api);

function makeRitual(over: Partial<Ritual> = {}): Ritual {
  return {
    id: "r1",
    template_key: null,
    title: "Movie Night",
    cadence: "weekly",
    description: null,
    day_of_week: 4,
    day_of_month: null,
    time_of_day: "20:00",
    timezone: "UTC",
    status: "active",
    next_instance: { id: "i1", scheduled_for: "2026-06-05T20:00:00Z", status: "planned" },
    ...over,
  };
}

describe("RitualsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.listRitualTemplates.mockResolvedValue([
      {
        key: "movie_night",
        title: "Movie Night",
        description: null,
        default_cadence: "weekly",
        icon: "🎬",
      },
    ]);
  });

  it("lists rituals and creates a new one", async () => {
    mockedApi.listRituals.mockResolvedValue([makeRitual()]);
    mockedApi.createRitual.mockResolvedValue(makeRitual({ id: "r2", title: "Game Night" }));

    render(<RitualsSection />);
    await waitFor(() => expect(screen.getByText("Movie Night")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Game Night" } });
    fireEvent.click(screen.getByRole("button", { name: "Add ritual" }));

    await waitFor(() => expect(screen.getByText("Game Night")).toBeInTheDocument());
    expect(mockedApi.createRitual).toHaveBeenCalledWith(
      "test-token",
      expect.objectContaining({ title: "Game Night", cadence: "weekly", day_of_week: 4 }),
    );
  });

  it("marks the next occurrence done", async () => {
    mockedApi.listRituals.mockResolvedValue([makeRitual()]);
    mockedApi.updateRitualInstance.mockResolvedValue(
      makeRitual({
        next_instance: { id: "i2", scheduled_for: "2026-06-12T20:00:00Z", status: "planned" },
      }),
    );

    render(<RitualsSection />);
    await waitFor(() => expect(screen.getByText("Movie Night")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Mark done" }));

    await waitFor(() =>
      expect(mockedApi.updateRitualInstance).toHaveBeenCalledWith("test-token", "r1", "i1", "done"),
    );
  });

  it("shows an empty state when there are no rituals", async () => {
    mockedApi.listRituals.mockResolvedValue([]);
    render(<RitualsSection />);
    await waitFor(() =>
      expect(screen.getByText(/No rituals yet/i)).toBeInTheDocument(),
    );
  });
});
