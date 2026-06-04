import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/lib/auth";

vi.mock("@/lib/api", () => ({
  login: vi.fn(async () => "tok-123"),
  register: vi.fn(async () => ({ id: "1", email: "a@b.com", display_name: "Alex" })),
  getMe: vi.fn(async () => ({
    id: "1",
    email: "a@b.com",
    display_name: "Alex",
    couple: null,
  })),
}));

function Consumer() {
  const { token, me, loading, login } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="token">{token ?? "none"}</span>
      <span data-testid="me">{me?.display_name ?? "none"}</span>
      <button onClick={() => login("a@b.com", "pw")}>login</button>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("logs in, stores the token, and loads the profile", async () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false"),
    );

    fireEvent.click(screen.getByText("login"));

    await waitFor(() =>
      expect(screen.getByTestId("me").textContent).toBe("Alex"),
    );
    expect(screen.getByTestId("token").textContent).toBe("tok-123");
    expect(window.localStorage.getItem("ldr_token")).toBe("tok-123");
  });

  it("restores a stored token on mount and fetches the profile", async () => {
    window.localStorage.setItem("ldr_token", "tok-xyz");
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("me").textContent).toBe("Alex"),
    );
    expect(screen.getByTestId("token").textContent).toBe("tok-xyz");
  });
});
