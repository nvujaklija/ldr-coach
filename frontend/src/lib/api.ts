// Thin API client. The base URL comes from the environment so the same
// build works across deploys (12-factor). In the browser, requests go to
// the reverse proxy at /api by default.
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

const TOKEN_KEY = "ldr_coach_token";

// --- token storage -------------------------------------------------------
// The JWT lives in localStorage so it survives reloads. Guarded for SSR,
// where `window` is undefined.
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
}

// --- fetch wrapper -------------------------------------------------------
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface ApiFetchOptions {
  method?: string;
  body?: unknown;
  auth?: boolean; // attach the bearer token (default true)
}

export async function apiFetch<T>(
  path: string,
  { method = "GET", body, auth = true }: ApiFetchOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    cache: "no-store",
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = `Request failed: ${res.status}`;
    try {
      const data = await res.json();
      if (data?.detail) detail = data.detail;
    } catch {
      /* non-JSON error body — keep the default message */
    }
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// --- health (existing) ---------------------------------------------------
export interface HealthResponse {
  status: string;
}

export async function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/health", { auth: false });
}

// --- auth ----------------------------------------------------------------
export interface User {
  id: string;
  email: string;
  display_name: string;
}

export async function registerUser(
  email: string,
  password: string,
  displayName: string,
): Promise<User> {
  return apiFetch<User>("/auth/register", {
    method: "POST",
    auth: false,
    body: { email, password, display_name: displayName },
  });
}

export async function loginUser(email: string, password: string): Promise<string> {
  // OAuth2 password flow expects form-encoded data, not JSON.
  const form = new URLSearchParams({ username: email, password });
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (!res.ok) {
    throw new ApiError(res.status, "Incorrect email or password");
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export async function getMe(): Promise<User> {
  return apiFetch<User>("/auth/me");
}
