import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import AppShell, { NAV_ITEMS } from "@/components/AppShell";

let pathname = "/app/rituals";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

// AppShell applies the saved theme and renders the notification center; stub
// those collaborators so the test focuses on navigation behavior.
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ token: null }) }));
vi.mock("@/lib/api", () => ({ getSettings: vi.fn(() => new Promise(() => {})) }));
vi.mock("@/lib/theme", () => ({ applyTheme: vi.fn() }));
vi.mock("@/components/NotificationCenter", () => ({
  default: () => null,
}));

describe("AppShell", () => {
  beforeEach(() => {
    pathname = "/app/rituals";
  });

  it("renders a link for every navigation item", () => {
    render(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );
    for (const item of NAV_ITEMS) {
      // The label appears in both the desktop sidebar and the drawer, so use
      // getAllByText and assert at least one is present.
      expect(screen.getAllByText(item.label).length).toBeGreaterThan(0);
    }
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("marks the current route as active", () => {
    render(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );
    const active = screen
      .getAllByRole("link", { name: /Rituals/ })
      .find((el) => el.getAttribute("aria-current") === "page");
    expect(active).toBeTruthy();
  });

  it("keeps Home active only on the exact /app route", () => {
    pathname = "/app";
    render(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );
    const home = screen
      .getAllByRole("link", { name: /Home/ })
      .find((el) => el.getAttribute("aria-current") === "page");
    expect(home).toBeTruthy();
  });

  it("toggles the mobile drawer open and closed", () => {
    const { container } = render(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );
    const sidebar = container.querySelector(".sidebar")!;
    expect(sidebar.className).not.toContain("open");

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(sidebar.className).toContain("open");

    fireEvent.click(screen.getByRole("button", { name: "Close menu" }));
    expect(sidebar.className).not.toContain("open");
  });
});
