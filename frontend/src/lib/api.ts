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

// --- visits --------------------------------------------------------------
export interface Visit {
  id: string;
  location: string;
  start_date: string; // ISO date (YYYY-MM-DD)
  end_date: string | null;
  notes: string | null;
  status: "planned" | "completed" | "cancelled";
  days_until: number | null;
}

export interface VisitInput {
  location: string;
  start_date: string;
  end_date?: string | null;
  notes?: string | null;
}

export async function getNextVisit(): Promise<Visit | null> {
  return apiFetch<Visit | null>("/visits/next");
}

export async function createVisit(input: VisitInput): Promise<Visit> {
  return apiFetch<Visit>("/visits", { method: "POST", body: input });
}

export async function updateVisit(
  id: string,
  patch: Partial<VisitInput & { status: Visit["status"] }>,
): Promise<Visit> {
  return apiFetch<Visit>(`/visits/${id}`, { method: "PATCH", body: patch });
}

// --- milestones ----------------------------------------------------------
export interface Milestone {
  id: string;
  visit_id: string | null;
  title: string;
  status: "todo" | "done";
  due_date: string | null;
  notes: string | null;
}

export async function listMilestones(visitId?: string): Promise<Milestone[]> {
  const query = visitId ? `?visitId=${encodeURIComponent(visitId)}` : "";
  return apiFetch<Milestone[]>(`/milestones${query}`);
}

export async function createMilestone(
  title: string,
  visitId?: string | null,
): Promise<Milestone> {
  return apiFetch<Milestone>("/milestones", {
    method: "POST",
    body: { title, visit_id: visitId ?? null },
  });
}

export async function updateMilestone(
  id: string,
  patch: Partial<{ title: string; status: Milestone["status"] }>,
): Promise<Milestone> {
  return apiFetch<Milestone>(`/milestones/${id}`, { method: "PATCH", body: patch });
export interface Member {
  user_id: string;
  display_name: string;
  role: string;
}

export interface Couple {
  id: string;
  name: string;
  members: Member[];
}

export interface Me extends User {
  couple: Couple | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface Invite {
  code: string;
  invite_url: string;
  expires_at: string;
  accepted: boolean;
}

/** Error carrying the HTTP status and the API's human-readable detail. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function parseError(res: Response): Promise<ApiError> {
  let detail = res.statusText || "Request failed";
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") {
      detail = body.detail;
    } else if (Array.isArray(body?.detail) && body.detail[0]?.msg) {
      // FastAPI validation errors come back as a list of issues.
      detail = body.detail[0].msg;
    }
  } catch {
    // Non-JSON error body; keep the status text.
  }
  return new ApiError(res.status, detail);
}

interface RequestOptions {
  method?: string;
  token?: string;
  json?: unknown;
  form?: Record<string, string>;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;

  if (opts.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.json);
  } else if (opts.form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(opts.form).toString();
  }
  if (opts.token) {
    headers["Authorization"] = `Bearer ${opts.token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body,
    cache: "no-store",
  });
  if (!res.ok) {
    throw await parseError(res);
  }
  // 204-style empty responses are not expected here, but guard anyway.
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export async function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/health");
}

export async function register(
  email: string,
  password: string,
  displayName: string,
): Promise<User> {
  return request<User>("/auth/register", {
    method: "POST",
    json: { email, password, display_name: displayName },
  });
}

export async function login(email: string, password: string): Promise<string> {
  // The backend uses the OAuth2 password form: "username" carries the email.
  const token = await request<TokenResponse>("/auth/login", {
    method: "POST",
    form: { username: email, password },
  });
  return token.access_token;
}

export async function getMe(token: string): Promise<Me> {
  return request<Me>("/auth/me", { token });
}

export async function createCouple(token: string, name: string): Promise<Couple> {
  return request<Couple>("/couples", { method: "POST", token, json: { name } });
}

export async function createInvite(token: string): Promise<Invite> {
  return request<Invite>("/couples/invites", { method: "POST", token });
}

export async function joinCouple(token: string, code: string): Promise<Couple> {
  return request<Couple>("/couples/join", { method: "POST", token, json: { code } });
}
