import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import BeRealView from "@/components/BeRealView";
import * as api from "@/lib/api";
import type { BeRealMoment, BeRealStatus } from "@/lib/api";

vi.mock("@/lib/api");
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ token: "test-token" }),
}));
const mockedApi = vi.mocked(api);

function makeMoment(over: Partial<BeRealMoment> = {}): BeRealMoment {
  return {
    id: "m1",
    scheduled_utc: "2026-06-06T15:00:00Z",
    status: "waiting",
    is_open: true,
    you_posted: false,
    partner_posted: false,
    posts: [],
    ...over,
  };
}

function makeStatus(over: Partial<BeRealStatus> = {}): BeRealStatus {
  return {
    is_active: true,
    next_utc: "2026-06-06T15:00:00Z",
    current_moment: null,
    partners: [],
    ...over,
  };
}

describe("BeRealView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.listBeRealMoments.mockResolvedValue({
      moments: [],
      total: 0,
      limit: 20,
      offset: 0,
    });
  });

  it("explains the concept and shows it is off when inactive", async () => {
    mockedApi.getBeRealStatus.mockResolvedValue(makeStatus({ is_active: false }));
    render(<BeRealView />);
    await waitFor(() => expect(screen.getByText("BeReal is off")).toBeInTheDocument());
    expect(screen.getByText(/Turn it on in Settings/i)).toBeInTheDocument();
  });

  it("shows the next scheduled time per partner timezone when no moment is open", async () => {
    mockedApi.getBeRealStatus.mockResolvedValue(
      makeStatus({
        partners: [
          {
            user_id: "u1",
            display_name: "Alex",
            timezone: "America/New_York",
            local_time: "2026-06-06T11:00:00-04:00",
          },
          {
            user_id: "u2",
            display_name: "Sam",
            timezone: "Europe/Rome",
            local_time: "2026-06-06T17:00:00+02:00",
          },
        ],
      }),
    );
    render(<BeRealView />);
    await waitFor(() => expect(screen.getByText("Next BeReal")).toBeInTheDocument());
    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.getByText("Sam")).toBeInTheDocument();
    expect(screen.getByText(/America\/New_York/)).toBeInTheDocument();
    expect(screen.getByText(/Europe\/Rome/)).toBeInTheDocument();
  });

  it("uploads a photo for the live moment", async () => {
    mockedApi.getBeRealStatus.mockResolvedValue(
      makeStatus({ current_moment: makeMoment() }),
    );
    mockedApi.postBeRealPhoto.mockResolvedValue(
      makeMoment({ you_posted: true, partner_posted: false }),
    );

    render(<BeRealView />);
    await waitFor(() =>
      expect(screen.getByText("Post your BeReal ⏰")).toBeInTheDocument(),
    );

    const file = new File(["x"], "me.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("Your photo"), { target: { files: [file] } });

    await waitFor(() =>
      expect(screen.getByText(/Your partner.*unlocks/i)).toBeInTheDocument(),
    );
    expect(mockedApi.postBeRealPhoto).toHaveBeenCalledWith("test-token", "m1", file);
  });

  it("shows both photos once the moment is complete", async () => {
    mockedApi.getBeRealStatus.mockResolvedValue(
      makeStatus({
        current_moment: makeMoment({
          status: "completed",
          you_posted: true,
          partner_posted: true,
          posts: [
            {
              id: "p1",
              user_id: "u1",
              image_url: "/api/media/a.jpg",
              posted_at: "2026-06-06T15:05:00Z",
            },
            {
              id: "p2",
              user_id: "u2",
              image_url: "/api/media/b.jpg",
              posted_at: "2026-06-06T15:06:00Z",
            },
          ],
        }),
      }),
    );

    render(<BeRealView />);
    await waitFor(() =>
      expect(screen.getByText(/You both posted/i)).toBeInTheDocument(),
    );
    expect(screen.getAllByAltText("BeReal moment")).toHaveLength(2);
  });
});
