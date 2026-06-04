import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CheckInCard from "@/components/CheckInCard";

function jsonResponse(body: unknown, ok = true, statusCode = 200) {
  return { ok, status: statusCode, json: async () => body } as Response;
}

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
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prompts to sign in when there is no token", async () => {
    window.localStorage.removeItem("ldr_token");
    render(<CheckInCard />);
    await waitFor(() =>
      expect(screen.getByText(/Sign in to record/i)).toBeInTheDocument(),
    );
  });

  it("shows the 7-day averages once loaded", async () => {
    window.localStorage.setItem("ldr_token", "tok");
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(POPULATED_LIST)));

    render(<CheckInCard />);
    await waitFor(() =>
      expect(screen.getByTestId("averages")).toHaveTextContent(
        "mood 4.0 · connection 5.0",
      ),
    );
  });

  it("submits today's check-in and refreshes", async () => {
    window.localStorage.setItem("ldr_token", "tok");

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return jsonResponse(POPULATED_LIST.check_ins[0], true, 201);
      }
      // First GET is empty; after submit, return the populated list.
      return jsonResponse(fetchMock.mock.calls.length > 1 ? POPULATED_LIST : EMPTY_LIST);
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<CheckInCard />);
    await waitFor(() => screen.getByText(/No check-ins yet this week/i));

    fireEvent.click(screen.getByRole("radio", { name: /Good \(4 of 5\)/i }));
    fireEvent.click(screen.getByRole("radio", { name: /Connected \(5 of 5\)/i }));
    fireEvent.click(screen.getByRole("button", { name: /Save check-in/i }));

    await waitFor(() =>
      expect(screen.getByText("Check-in saved.")).toBeInTheDocument(),
    );

    // POST body carried the selected scores.
    const postCall = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === "POST",
    );
    expect(postCall).toBeDefined();
    expect(JSON.parse((postCall![1] as RequestInit).body as string)).toMatchObject({
      mood_score: 4,
      connection_score: 5,
    });
    await waitFor(() =>
      expect(screen.getByTestId("averages")).toBeInTheDocument(),
    );
  });

  it("disables submit until both scores are chosen", async () => {
    window.localStorage.setItem("ldr_token", "tok");
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(EMPTY_LIST)));

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
