import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import NextVisitWidget from "@/components/NextVisitWidget";
import * as api from "@/lib/api";

vi.mock("@/lib/api");
// MilestoneList does its own fetching; stub it out so this test stays focused.
vi.mock("@/components/MilestoneList", () => ({
  default: () => <div data-testid="milestones" />,
}));

const mockedApi = vi.mocked(api);

describe("NextVisitWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the countdown when a next visit exists", async () => {
    mockedApi.getNextVisit.mockResolvedValue({
      id: "v1",
      location: "Lisbon",
      start_date: "2026-07-01",
      end_date: "2026-07-08",
      notes: null,
      status: "planned",
      days_until: 28,
    });

    render(<NextVisitWidget />);

    await waitFor(() =>
      expect(screen.getByTestId("countdown")).toHaveTextContent("28"),
    );
    expect(screen.getByText("28 days to go")).toBeInTheDocument();
    expect(screen.getByText("Lisbon")).toBeInTheDocument();
  });

  it("shows the create form and starts a countdown when none exists", async () => {
    mockedApi.getNextVisit.mockResolvedValue(null);
    mockedApi.createVisit.mockResolvedValue({
      id: "v2",
      location: "Oslo",
      start_date: "2026-08-01",
      end_date: null,
      notes: null,
      status: "planned",
      days_until: 10,
    });

    render(<NextVisitWidget />);

    await waitFor(() =>
      expect(screen.getByText("Plan your next visit")).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByLabelText("Where"), { target: { value: "Oslo" } });
    fireEvent.change(screen.getByLabelText("Arrives"), {
      target: { value: "2026-08-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start the countdown" }));

    await waitFor(() =>
      expect(screen.getByTestId("countdown")).toHaveTextContent("10"),
    );
    expect(mockedApi.createVisit).toHaveBeenCalledWith({
      location: "Oslo",
      start_date: "2026-08-01",
      end_date: null,
    });
  });
});
