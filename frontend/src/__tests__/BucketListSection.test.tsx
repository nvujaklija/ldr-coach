import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import BucketListSection from "@/components/BucketListSection";
import * as api from "@/lib/api";
import type { BucketItem } from "@/lib/api";

vi.mock("@/lib/api");
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ token: "test-token" }),
}));
const mockedApi = vi.mocked(api);

function item(over: Partial<BucketItem> = {}): BucketItem {
  return {
    id: "b1",
    title: "Hot air balloon ride",
    category: "Experience",
    target_visit_id: null,
    status: "planned",
    notes: null,
    ...over,
  };
}

describe("BucketListSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.getNextVisit.mockResolvedValue(null);
  });

  it("groups items by status and adds a new one", async () => {
    mockedApi.listBucketItems.mockResolvedValue([
      item(),
      item({ id: "b2", title: "Learn to surf", status: "done", category: null }),
    ]);
    mockedApi.createBucketItem.mockResolvedValue(
      item({ id: "b3", title: "See the Northern Lights", category: null }),
    );

    render(<BucketListSection />);
    await waitFor(() =>
      expect(screen.getByText("Hot air balloon ride")).toBeInTheDocument(),
    );
    // The "done" item appears too, under its group.
    expect(screen.getByText("Learn to surf")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("New goal"), {
      target: { value: "See the Northern Lights" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(screen.getByText("See the Northern Lights")).toBeInTheDocument(),
    );
    expect(mockedApi.createBucketItem).toHaveBeenCalledWith(
      "test-token",
      expect.objectContaining({ title: "See the Northern Lights", target_visit_id: null }),
    );
  });

  it("moves an item to a new status", async () => {
    mockedApi.listBucketItems.mockResolvedValue([item()]);
    mockedApi.updateBucketItem.mockResolvedValue(item({ status: "in_progress" }));

    render(<BucketListSection />);
    await waitFor(() =>
      expect(screen.getByText("Hot air balloon ride")).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByLabelText("Status for Hot air balloon ride"), {
      target: { value: "in_progress" },
    });

    await waitFor(() =>
      expect(mockedApi.updateBucketItem).toHaveBeenCalledWith("test-token", "b1", {
        status: "in_progress",
      }),
    );
  });

  it("offers a link to the next trip when one is planned", async () => {
    mockedApi.listBucketItems.mockResolvedValue([]);
    mockedApi.getNextVisit.mockResolvedValue({
      id: "v1",
      location: "Lake Como",
      start_date: "2026-08-01",
      end_date: null,
      notes: null,
      status: "planned",
      days_until: 58,
    });

    render(<BucketListSection />);
    await waitFor(() =>
      expect(screen.getByText(/Link to next trip \(Lake Como\)/i)).toBeInTheDocument(),
    );
  });
});
