import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import * as api from "@/lib/api";
import type { Me } from "@/lib/api";

vi.mock("@/lib/api");
const mockedApi = vi.mocked(api);

let me: Me | null = null;
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ token: "test-token", me }),
}));

const pairedCouple = {
  id: "c1",
  name: "Alex & Sam",
  members: [
    { user_id: "1", display_name: "Alex", role: "partner" },
    { user_id: "2", display_name: "Sam", role: "partner" },
  ],
};

describe("OnboardingChecklist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.getNextVisit.mockResolvedValue(null);
    mockedApi.getCheckIns.mockResolvedValue({
      check_ins: [],
      averages: { count: 0, mood_score: null, connection_score: null },
    });
    mockedApi.listRituals.mockResolvedValue([]);
  });

  it("shows progress and the open steps when nothing is set up", async () => {
    me = { id: "1", email: "a@b.com", display_name: "Alex", couple: null };
    render(<OnboardingChecklist />);
    // Account step is always done; couple/visit/etc. are not.
    expect(screen.getByText("1 of 6 done — a few small steps to settle in.")).toBeInTheDocument();
    expect(screen.getByText("Start your couple")).toBeInTheDocument();
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "17");
  });

  it("marks couple steps done and reflects fetched feature state", async () => {
    me = { id: "1", email: "a@b.com", display_name: "Alex", couple: pairedCouple };
    mockedApi.getNextVisit.mockResolvedValue({
      id: "v1",
      location: "Lisbon",
      start_date: "2026-07-01",
      end_date: null,
      notes: null,
      status: "planned",
      days_until: 26,
    });
    render(<OnboardingChecklist />);
    // 3 immediate (account + couple + invite), then visit resolves to 4.
    await waitFor(() =>
      expect(screen.getByText("4 of 6 done — a few small steps to settle in.")).toBeInTheDocument(),
    );
  });
});
