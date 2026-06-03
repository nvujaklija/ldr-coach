import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import BackendStatus from "@/components/BackendStatus";

describe("BackendStatus", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the connected state when the API is healthy", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ status: "ok" }),
      })) as unknown as typeof fetch,
    );

    render(<BackendStatus />);
    await waitFor(() =>
      expect(screen.getByText("API connected")).toBeInTheDocument(),
    );
  });

  it("shows the unreachable state when the API errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }) as unknown as typeof fetch,
    );

    render(<BackendStatus />);
    await waitFor(() =>
      expect(screen.getByText("API unreachable")).toBeInTheDocument(),
    );
  });
});
