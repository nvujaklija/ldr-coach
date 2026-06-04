import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import LettersSection from "@/components/LettersSection";
import * as api from "@/lib/api";
import type { Letter } from "@/lib/api";

vi.mock("@/lib/api");
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ token: "test-token" }),
}));
const mockedApi = vi.mocked(api);

function makeLetter(over: Partial<Letter> = {}): Letter {
  return {
    id: "l1",
    couple_id: "c1",
    from_user_id: "u2",
    to_user_id: "u1",
    from_name: "Sam",
    to_name: "Alex",
    title: "Hello",
    body: "Thinking of you",
    visible_from: "2026-01-01T00:00:00Z",
    is_opened: false,
    is_locked: false,
    direction: "received",
    created_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("LettersSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.listLetters.mockResolvedValue([]);
  });

  it("hides a locked letter's body and shows the unlock notice", async () => {
    mockedApi.listLetters.mockResolvedValue([
      makeLetter({ is_locked: true, body: null, title: "Future note" }),
    ]);
    render(<LettersSection />);

    await waitFor(() => expect(screen.getByText("Future note")).toBeInTheDocument());
    expect(screen.getByText(/Unlocks/i)).toBeInTheDocument();
    expect(screen.queryByText("Thinking of you")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Read" })).not.toBeInTheDocument();
  });

  it("opens an unlocked received letter to reveal the body", async () => {
    mockedApi.listLetters.mockResolvedValue([makeLetter()]);
    mockedApi.openLetter.mockResolvedValue(makeLetter({ is_opened: true }));
    render(<LettersSection />);

    await waitFor(() => expect(screen.getByText("Hello")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Read" }));

    await waitFor(() => expect(screen.getByText("Thinking of you")).toBeInTheDocument());
    expect(mockedApi.openLetter).toHaveBeenCalledWith("test-token", "l1");
  });

  it("sends a letter and refreshes the list", async () => {
    mockedApi.createLetter.mockResolvedValue(
      makeLetter({ id: "l2", direction: "sent" }),
    );
    render(<LettersSection />);
    await waitFor(() => expect(screen.getByText(/none waiting for you/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Surprise" } });
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "xoxo" } });
    fireEvent.click(screen.getByRole("button", { name: "Send letter" }));

    await waitFor(() =>
      expect(mockedApi.createLetter).toHaveBeenCalledWith(
        "test-token",
        expect.objectContaining({ title: "Surprise", body: "xoxo" }),
      ),
    );
  });

  it("switches to the sent box", async () => {
    render(<LettersSection />);
    await waitFor(() => expect(mockedApi.listLetters).toHaveBeenCalledWith("test-token", "inbox"));

    fireEvent.click(screen.getByRole("tab", { name: "Sent" }));
    await waitFor(() =>
      expect(mockedApi.listLetters).toHaveBeenCalledWith("test-token", "sent"),
    );
  });
});
