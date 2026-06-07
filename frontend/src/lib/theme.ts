import type { Theme } from "@/lib/api";

/**
 * Reflect the user's theme choice onto <html data-theme="…">, which the CSS
 * in globals.css keys off. "system" defers to the OS via prefers-color-scheme.
 * No-op on the server.
 */
export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
}
