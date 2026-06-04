// Thin API client. The base URL comes from the environment so the same
// build works across deploys (12-factor). In the browser, requests go to
// the reverse proxy at /api by default.
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

export interface HealthResponse {
  status: string;
}

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/health`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.status}`);
  }
  return res.json();
}

// --- Auth ---------------------------------------------------------------

const TOKEN_KEY = "ldr_token";

// The access token is persisted by the (future) login flow. Reading it here
// keeps the API helpers usable today and ready to wire up once auth lands.
export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Raised when a request needs a signed-in user but no token is present. */
export class NotAuthenticatedError extends Error {
  constructor() {
    super("Not signed in");
    this.name = "NotAuthenticatedError";
  }
}

// --- Check-ins ----------------------------------------------------------

export interface CheckIn {
  id: string;
  user_id: string;
  couple_id: string | null;
  date: string;
  mood_score: number;
  connection_score: number;
  tags: string[];
  note: string | null;
}

export interface CheckInInput {
  mood_score: number;
  connection_score: number;
  tags?: string[];
  note?: string | null;
}

export interface CheckInAverages {
  count: number;
  mood_score: number | null;
  connection_score: number | null;
}

export interface CheckInList {
  check_ins: CheckIn[];
  averages: CheckInAverages;
}

export async function submitTodayCheckIn(input: CheckInInput): Promise<CheckIn> {
  const token = getAuthToken();
  if (!token) throw new NotAuthenticatedError();
  const res = await fetch(`${API_BASE}/checkins/today`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`Check-in failed: ${res.status}`);
  }
  return res.json();
}

export async function getCheckIns(days = 7): Promise<CheckInList> {
  const token = getAuthToken();
  if (!token) throw new NotAuthenticatedError();
  const res = await fetch(`${API_BASE}/checkins?days=${days}`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Loading check-ins failed: ${res.status}`);
  }
  return res.json();
}
