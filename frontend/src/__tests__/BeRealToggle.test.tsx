import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import BeRealToggle from "@/components/BeRealToggle";
import * as api from "@/lib/api";
import type { BeRealStatus } from "@/lib/api";

vi.mock("@/lib/api");
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ token: "test-token" }),
}));
const mockedApi = vi.mocked(api);

function makeStatus(over: Partial<BeRealStatus> = {}): BeRealStatus {
  return {
    is_active: false,
    next_utc: null,
    current_moment: null,
    partners: [],
    ...over,
  };
}

describe("BeRealToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("turns BeReal on when currently off", async () => {
    mockedApi.getBeRealStatus.mockResolvedValue(makeStatus({ is_active: false }));
    mockedApi.enableBeReal.mockResolvedValue(makeStatus({ is_active: true }));

    render(<BeRealToggle />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Turn on BeReal" })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Turn on BeReal" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Turn off BeReal" })).toBeInTheDocument(),
    );
    expect(mockedApi.enableBeReal).toHaveBeenCalledWith("test-token", expect.any(String));
  });

  it("turns BeReal off when currently on", async () => {
    mockedApi.getBeRealStatus.mockResolvedValue(makeStatus({ is_active: true }));
    mockedApi.disableBeReal.mockResolvedValue(makeStatus({ is_active: false }));

    render(<BeRealToggle />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Turn off BeReal" })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Turn off BeReal" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Turn on BeReal" })).toBeInTheDocument(),
    );
    expect(mockedApi.disableBeReal).toHaveBeenCalledWith("test-token");
  });

  it("shows an error when the status fails to load", async () => {
    mockedApi.getBeRealStatus.mockRejectedValue(new Error("nope"));
    render(<BeRealToggle />);
    await waitFor(() =>
      expect(screen.getByText(/Could not load BeReal settings/i)).toBeInTheDocument(),
    );
  });
});
