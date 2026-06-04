import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import MemoriesTimeline from "@/components/MemoriesTimeline";
import * as api from "@/lib/api";
import type { MemoryItem } from "@/lib/api";

vi.mock("@/lib/api");
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ token: "test-token" }),
}));
const mockedApi = vi.mocked(api);

function makeMemory(over: Partial<MemoryItem> = {}): MemoryItem {
  return {
    id: "m1",
    type: "visit",
    data: { title: "Visited Lisbon", source: "visit" },
    created_by_id: null,
    created_at: "2026-05-01T00:00:00Z",
    ...over,
  };
}

describe("MemoriesTimeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the timeline newest-first as the API returns it", async () => {
    mockedApi.listMemories.mockResolvedValue([
      makeMemory(),
      makeMemory({ id: "m2", type: "note", data: { title: "First call" } }),
    ]);
    render(<MemoriesTimeline />);

    await waitFor(() => expect(screen.getByText("Visited Lisbon")).toBeInTheDocument());
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Visited Lisbon");
    expect(items[1]).toHaveTextContent("First call");
  });

  it("shows an empty state", async () => {
    mockedApi.listMemories.mockResolvedValue([]);
    render(<MemoriesTimeline />);
    await waitFor(() =>
      expect(screen.getByText(/No memories yet/i)).toBeInTheDocument(),
    );
  });

  it("adds a manual memory and prepends it", async () => {
    mockedApi.listMemories.mockResolvedValue([]);
    mockedApi.createMemory.mockResolvedValue(
      makeMemory({ id: "m9", type: "note", data: { title: "New note" } }),
    );
    render(<MemoriesTimeline />);
    await waitFor(() => expect(screen.getByText(/No memories yet/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New note" } });
    fireEvent.click(screen.getByRole("button", { name: "Add memory" }));

    await waitFor(() => expect(screen.getByText("New note")).toBeInTheDocument());
    expect(mockedApi.createMemory).toHaveBeenCalledWith("test-token", "note", {
      title: "New note",
    });
  });
});
