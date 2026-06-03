import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import RequireAuth from "@/components/RequireAuth";
import { AuthProvider } from "@/lib/auth";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

vi.mock("@/lib/api", () => ({
  getMe: vi.fn(async () => ({
    id: "1",
    email: "a@b.com",
    display_name: "Alex",
    couple: null,
  })),
}));

describe("RequireAuth", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("redirects to login when there is no token", async () => {
    render(
      <AuthProvider>
        <RequireAuth returnTo="/app">
          <p>secret</p>
        </RequireAuth>
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/login?next=%2Fapp"),
    );
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });

  it("renders children when a token is present", async () => {
    window.localStorage.setItem("ldr_token", "tok-xyz");
    render(
      <AuthProvider>
        <RequireAuth returnTo="/app">
          <p>secret</p>
        </RequireAuth>
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByText("secret")).toBeInTheDocument(),
    );
    expect(replace).not.toHaveBeenCalled();
  });
});
