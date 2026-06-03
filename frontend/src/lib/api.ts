// Thin API client. The base URL comes from the environment so the same
// build works across deploys (12-factor). In the browser, requests go to
// the reverse proxy at /api by default.
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

export interface HealthResponse {
  status: string;
}

export interface User {
  id: string;
  email: string;
  display_name: string;
}

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
