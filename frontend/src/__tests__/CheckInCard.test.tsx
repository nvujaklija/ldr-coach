import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CheckInCard from "@/components/CheckInCard";
import * as api from "@/lib/api";

vi.mock("@/lib/api");
// The card reads the token from the auth context.
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ token: "test-token" }),
}));

const mockedApi = vi.mocked(api);

const EMPTY_LIST = {
  check_ins: [],
  averages: { count: 0, mood_score: null, connection_score: null },
};

const POPULATED_LIST = {
  check_ins: [
    {
      id: "c1",
      user_id: "u1",
      couple_id: null,
      date: "2026-06-04",
      mood_score: 4,
      connection_score: 5,
      tags: ["happy"],
      note: null,
    },
  ],
  averages: { count: 1, mood_score: 4.0, connection_score: 5.0 },
};

describe("CheckInCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the 7-day averages once loaded", async () => {
    mockedApi.getCheckIns.mockResolvedValue(POPULATED_LIST);

    render(<CheckInCard />);
    await waitFor(() =>
      expect(screen.getByTestId("averages")).toHaveTextContent(
        "mood 4.0 · connection 5.0",
      ),
    );
    expect(mockedApi.getCheckIns).toHaveBeenCalledWith("test-token", 7);
  });

  it("submits today's check-in and refreshes the averages", async () => {
    mockedApi.getCheckIns
      .mockResolvedValueOnce(EMPTY_LIST)
      .mockResolvedValue(POPULATED_LIST);
    mockedApi.submitTodayCheckIn.mockResolvedValue(POPULATED_LIST.check_ins[0]);

    render(<CheckInCard />);
    await waitFor(() => screen.getByText(/No check-ins yet this week/i));

    fireEvent.click(screen.getByRole("radio", { name: /Good \(4 of 5\)/i }));
    fireEvent.click(screen.getByRole("radio", { name: /Connected \(5 of 5\)/i }));
    fireEvent.click(screen.getByRole("button", { name: /Save check-in/i }));

    await waitFor(() =>
      expect(screen.getByText("Check-in saved.")).toBeInTheDocument(),
    );
    expect(mockedApi.submitTodayCheckIn).toHaveBeenCalledWith("test-token", {
      mood_score: 4,
      connection_score: 5,
      tags: [],
      note: null,
    });
    await waitFor(() =>
      expect(screen.getByTestId("averages")).toBeInTheDocument(),
    );
  });

  it("disables submit until both scores are chosen", async () => {
    mockedApi.getCheckIns.mockResolvedValue(EMPTY_LIST);

    render(<CheckInCard />);
    await waitFor(() => screen.getByText(/No check-ins yet this week/i));

    const submit = screen.getByRole("button", { name: /Save check-in/i });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole("radio", { name: /Good \(4 of 5\)/i }));
    expect(submit).toBeDisabled(); // connection still unset

    fireEvent.click(screen.getByRole("radio", { name: /Connected \(5 of 5\)/i }));
    expect(submit).toBeEnabled();
  });
});
