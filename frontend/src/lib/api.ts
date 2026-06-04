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

export async function getNextVisit(token: string): Promise<Visit | null> {
  return request<Visit | null>("/visits/next", { token });
}

export async function createVisit(token: string, input: VisitInput): Promise<Visit> {
  return request<Visit>("/visits", { method: "POST", token, json: input });
}

export async function updateVisit(
  token: string,
  id: string,
  patch: Partial<VisitInput & { status: Visit["status"] }>,
): Promise<Visit> {
  return request<Visit>(`/visits/${id}`, { method: "PATCH", token, json: patch });
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

export async function listMilestones(
  token: string,
  visitId?: string,
): Promise<Milestone[]> {
  const query = visitId ? `?visitId=${encodeURIComponent(visitId)}` : "";
  return request<Milestone[]>(`/milestones${query}`, { token });
}

export async function createMilestone(
  token: string,
  title: string,
  visitId?: string | null,
): Promise<Milestone> {
  return request<Milestone>("/milestones", {
    method: "POST",
    token,
    json: { title, visit_id: visitId ?? null },
  });
}

export async function updateMilestone(
  token: string,
  id: string,
  patch: Partial<{ title: string; status: Milestone["status"] }>,
): Promise<Milestone> {
  return request<Milestone>(`/milestones/${id}`, { method: "PATCH", token, json: patch });
}

// --- check-ins -----------------------------------------------------------
export interface CheckIn {
  id: string;
  user_id: string;
  couple_id: string | null;
  date: string; // ISO date (YYYY-MM-DD)
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

export async function submitTodayCheckIn(
  token: string,
  input: CheckInInput,
): Promise<CheckIn> {
  return request<CheckIn>("/checkins/today", { method: "POST", token, json: input });
}

export async function getCheckIns(token: string, days = 7): Promise<CheckInList> {
  return request<CheckInList>(`/checkins?days=${days}`, { token });
}

// --- rituals -------------------------------------------------------------
export type RitualCadence = "daily" | "weekly" | "monthly";
export type RitualStatus = "active" | "paused" | "cancelled";

export interface RitualTemplate {
  key: string;
  title: string;
  description: string | null;
  default_cadence: string;
  icon: string | null;
}

export interface RitualInstance {
  id: string;
  scheduled_for: string; // ISO datetime (UTC)
  status: "planned" | "done" | "cancelled";
}

export interface Ritual {
  id: string;
  template_key: string | null;
  title: string;
  cadence: RitualCadence;
  description: string | null;
  day_of_week: number | null; // 0=Mon … 6=Sun
  day_of_month: number | null;
  time_of_day: string | null; // "HH:MM"
  timezone: string | null; // IANA
  status: RitualStatus;
  next_instance: RitualInstance | null;
}

export interface RitualInput {
  template_key?: string | null;
  title: string;
  cadence: RitualCadence;
  description?: string | null;
  day_of_week?: number | null;
  day_of_month?: number | null;
  time_of_day?: string | null;
  timezone?: string | null;
}

export async function listRitualTemplates(token: string): Promise<RitualTemplate[]> {
  return request<RitualTemplate[]>("/rituals/templates", { token });
}

export async function listRituals(token: string): Promise<Ritual[]> {
  return request<Ritual[]>("/rituals", { token });
}

export async function createRitual(token: string, input: RitualInput): Promise<Ritual> {
  return request<Ritual>("/rituals", { method: "POST", token, json: input });
}

export async function updateRitual(
  token: string,
  id: string,
  patch: Partial<RitualInput & { status: RitualStatus }>,
): Promise<Ritual> {
  return request<Ritual>(`/rituals/${id}`, { method: "PATCH", token, json: patch });
}

export async function updateRitualInstance(
  token: string,
  ritualId: string,
  instanceId: string,
  status: RitualInstance["status"],
): Promise<Ritual> {
  return request<Ritual>(`/rituals/${ritualId}/instances/${instanceId}`, {
    method: "PATCH",
    token,
    json: { status },
  });
}

// --- letters -------------------------------------------------------------
export type LetterBox = "inbox" | "sent";

export interface Letter {
  id: string;
  couple_id: string;
  from_user_id: string;
  to_user_id: string;
  from_name: string;
  to_name: string;
  title: string;
  body: string | null; // null while a received letter is still locked
  visible_from: string; // ISO datetime (UTC)
  is_opened: boolean;
  is_locked: boolean;
  direction: "sent" | "received";
  created_at: string;
}

export interface LetterInput {
  title: string;
  body: string;
  visible_from?: string | null; // ISO datetime; omit/past = unlocked now
  to_user_id?: string | null;
}

export async function listLetters(
  token: string,
  box: LetterBox = "inbox",
): Promise<Letter[]> {
  return request<Letter[]>(`/letters?box=${box}`, { token });
}

export async function createLetter(
  token: string,
  input: LetterInput,
): Promise<Letter> {
  return request<Letter>("/letters", { method: "POST", token, json: input });
}

export async function openLetter(token: string, id: string): Promise<Letter> {
  return request<Letter>(`/letters/${id}/open`, { method: "POST", token });
}

// --- memories ------------------------------------------------------------
export type MemoryType = "photo" | "note" | "ritual" | "visit";

export interface MemoryItem {
  id: string;
  type: MemoryType;
  data: Record<string, unknown> & { title?: string; source?: string };
  created_by_id: string | null;
  created_at: string;
}

export async function listMemories(
  token: string,
  limit = 20,
  offset = 0,
): Promise<MemoryItem[]> {
  return request<MemoryItem[]>(`/memories?limit=${limit}&offset=${offset}`, { token });
}

export async function createMemory(
  token: string,
  type: MemoryType,
  data: Record<string, unknown>,
): Promise<MemoryItem> {
  return request<MemoryItem>("/memories", { method: "POST", token, json: { type, data } });
}
