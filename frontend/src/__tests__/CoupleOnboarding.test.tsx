import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CoupleOnboarding from "@/components/CoupleOnboarding";
import { AuthProvider } from "@/lib/auth";

const couple = {
  id: "c1",
  name: "Alex & Sam",
  members: [{ user_id: "1", display_name: "Alex", role: "partner" }],
};

const getMe = vi.fn();
const createCouple = vi.fn(async () => couple);

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    getMe: (...args: unknown[]) => getMe(...args),
    createCouple: (...args: unknown[]) => createCouple(...args),
  };
});

describe("CoupleOnboarding", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("ldr_token", "tok-xyz");
    vi.clearAllMocks();
    // First load: no couple yet. After creating one: refresh returns it.
    getMe
      .mockResolvedValueOnce({ id: "1", email: "a@b.com", display_name: "Alex", couple: null })
      .mockResolvedValue({ id: "1", email: "a@b.com", display_name: "Alex", couple });
  });

  it("creates a couple and then shows it with an invite prompt", async () => {
    render(
      <AuthProvider>
        <CoupleOnboarding />
      </AuthProvider>,
    );

    // Onboarding choices appear once the (couple-less) profile loads.
    const nameInput = await screen.findByLabelText("Couple name");
    fireEvent.change(nameInput, { target: { value: "Alex & Sam" } });
    fireEvent.click(screen.getByRole("button", { name: "Create couple" }));

    await waitFor(() => expect(createCouple).toHaveBeenCalledWith("tok-xyz", "Alex & Sam"));

    // After refresh the couple view renders, including the invite-partner CTA.
    expect(await screen.findByText("Alex & Sam")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Generate invite" }),
    ).toBeInTheDocument();
  });
});
