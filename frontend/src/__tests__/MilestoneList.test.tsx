import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import MilestoneList from "@/components/MilestoneList";
import * as api from "@/lib/api";

vi.mock("@/lib/api");
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ token: "test-token" }),
}));
const mockedApi = vi.mocked(api);

describe("MilestoneList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists milestones and adds a new one", async () => {
    mockedApi.listMilestones.mockResolvedValue([
      { id: "m1", visit_id: "v1", title: "book flights", status: "todo", due_date: null, notes: null },
    ]);
    mockedApi.createMilestone.mockResolvedValue({
      id: "m2",
      visit_id: "v1",
      title: "finalize itinerary",
      status: "todo",
      due_date: null,
      notes: null,
    });

    render(<MilestoneList visitId="v1" />);

    await waitFor(() => expect(screen.getByText("book flights")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("New milestone"), {
      target: { value: "finalize itinerary" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(screen.getByText("finalize itinerary")).toBeInTheDocument(),
    );
    expect(mockedApi.createMilestone).toHaveBeenCalledWith(
      "test-token",
      "finalize itinerary",
      "v1",
    );
  });

  it("toggles a milestone to done", async () => {
    mockedApi.listMilestones.mockResolvedValue([
      { id: "m1", visit_id: "v1", title: "book flights", status: "todo", due_date: null, notes: null },
    ]);
    mockedApi.updateMilestone.mockResolvedValue({
      id: "m1",
      visit_id: "v1",
      title: "book flights",
      status: "done",
      due_date: null,
      notes: null,
    });

    render(<MilestoneList visitId="v1" />);

    const checkbox = await screen.findByRole("checkbox");
    fireEvent.click(checkbox);

    await waitFor(() =>
      expect(mockedApi.updateMilestone).toHaveBeenCalledWith("test-token", "m1", {
        status: "done",
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole("checkbox")).toBeChecked(),
    );
  });
});
