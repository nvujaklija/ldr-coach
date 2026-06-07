// Thin API client, ported from the web app. Uses the same FastAPI endpoints
// under the versioned /api/v1 prefix. The base URL is resolved from the
// environment (see config.ts) so one build can target any deploy.
import { API_BASE } from "./config";

export { API_BASE };

export interface HealthResponse {
  status: string;
}

export interface User {
  id: string;
  email: string;
  display_name: string;
  timezone: string;
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

/** A file to upload, as produced by expo-image-picker (uri + mime + name). */
export interface UploadFile {
  uri: string;
  name: string;
  type: string;
}

interface RequestOptions {
  method?: string;
  token?: string;
  json?: unknown;
  form?: Record<string, string>;
  // Multipart payload (file uploads). RN's FormData accepts {uri,name,type}.
  formData?: FormData;
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
  } else if (opts.formData) {
    // Intentionally no Content-Type: fetch adds the multipart boundary.
    body = opts.formData as unknown as BodyInit;
  }
  if (opts.token) {
    headers["Authorization"] = `Bearer ${opts.token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body,
  });
  if (!res.ok) {
    throw await parseError(res);
  }
  // 204-style empty responses are not expected here, but guard anyway.
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** Turn a relative media path from the API into an absolute, loadable URL. */
export function mediaUrl(path: string): string {
  if (!path) return path;
  if (/^https?:\/\//.test(path)) return path;
  // Media is served under the same origin as the API (minus the /api/v1 part
  // for absolute paths, or relative to the API root otherwise).
  if (path.startsWith("/")) {
    const origin = API_BASE.replace(/\/api\/v1$/, "");
    return `${origin}${path}`;
  }
  return `${API_BASE}/${path}`;
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

export async function listVisits(token: string): Promise<Visit[]> {
  return request<Visit[]>("/visits", { token });
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

// --- be-real -------------------------------------------------------------
export type BeRealMomentStatus = "waiting" | "completed" | "expired";

export interface BeRealPost {
  id: string;
  user_id: string;
  image_url: string;
  posted_at: string; // ISO datetime (UTC)
}

export interface BeRealMoment {
  id: string;
  scheduled_utc: string; // ISO datetime (UTC)
  status: BeRealMomentStatus;
  is_open: boolean;
  you_posted: boolean;
  partner_posted: boolean;
  posts: BeRealPost[]; // visibility-filtered by the backend
}

export interface BeRealPartnerTime {
  user_id: string;
  display_name: string;
  timezone: string; // IANA
  local_time: string | null; // next moment in this partner's tz, ISO
}

export interface BeRealStatus {
  is_active: boolean;
  next_utc: string | null;
  current_moment: BeRealMoment | null;
  partners: BeRealPartnerTime[];
}

export interface BeRealMomentList {
  moments: BeRealMoment[];
  total: number;
  limit: number;
  offset: number;
}

export async function getBeRealStatus(token: string): Promise<BeRealStatus> {
  return request<BeRealStatus>("/be-real/status", { token });
}

export async function enableBeReal(token: string, timezone?: string): Promise<BeRealStatus> {
  return request<BeRealStatus>("/be-real/enable", {
    method: "POST",
    token,
    json: { timezone: timezone ?? null },
  });
}

export async function disableBeReal(token: string): Promise<BeRealStatus> {
  return request<BeRealStatus>("/be-real/disable", { method: "POST", token });
}

export async function postBeRealPhoto(
  token: string,
  momentId: string,
  file: UploadFile,
): Promise<BeRealMoment> {
  const formData = new FormData();
  // RN's FormData takes a {uri,name,type} object for file parts.
  formData.append("image", file as unknown as Blob);
  return request<BeRealMoment>(`/be-real/moments/${momentId}/post`, {
    method: "POST",
    token,
    formData,
  });
}

export async function listBeRealMoments(
  token: string,
  limit = 20,
  offset = 0,
): Promise<BeRealMomentList> {
  return request<BeRealMomentList>(`/be-real/moments?limit=${limit}&offset=${offset}`, {
    token,
  });
}

export async function getBeRealMoment(token: string, id: string): Promise<BeRealMoment> {
  return request<BeRealMoment>(`/be-real/moments/${id}`, { token });
}

// --- settings ------------------------------------------------------------
export type Theme = "system" | "light" | "dark";

export interface UserSettings {
  timezone: string; // IANA
  theme: Theme;
  notify_checkin_reminders: boolean;
  notify_visit_reminders: boolean;
  notify_ritual_reminders: boolean;
}

export interface CoupleSettings {
  relationship_start_date: string | null; // ISO date (YYYY-MM-DD)
  show_visits: boolean;
  show_rituals: boolean;
  show_checkins: boolean;
}

export interface Settings {
  user: UserSettings;
  couple: CoupleSettings | null;
}

export interface SettingsUpdate {
  user?: Partial<UserSettings>;
  couple?: Partial<CoupleSettings>;
}

export async function getSettings(token: string): Promise<Settings> {
  return request<Settings>("/settings", { token });
}

export async function updateSettings(
  token: string,
  patch: SettingsUpdate,
): Promise<Settings> {
  return request<Settings>("/settings", { method: "PUT", token, json: patch });
}

// --- notifications -------------------------------------------------------
export type NotificationType = "visit_reminder" | "ritual_reminder";

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  payload: Record<string, unknown>;
  trigger_at: string; // ISO datetime (UTC)
  read_at: string | null;
  created_at: string;
}

export interface NotificationList {
  notifications: AppNotification[];
  unread_count: number;
}

export interface NotificationPreferences {
  visit_reminder_days: number;
  visit_reminders_enabled: boolean;
  ritual_reminders_enabled: boolean;
  in_app_enabled: boolean;
  email_enabled: boolean;
}

export async function listNotifications(
  token: string,
  includeRead = false,
): Promise<NotificationList> {
  const query = includeRead ? "?include_read=true" : "";
  return request<NotificationList>(`/notifications${query}`, { token });
}

export async function markNotificationRead(
  token: string,
  id: string,
): Promise<AppNotification> {
  return request<AppNotification>(`/notifications/${id}/read`, { method: "POST", token });
}

export async function markAllNotificationsRead(
  token: string,
): Promise<NotificationList> {
  return request<NotificationList>("/notifications/read-all", { method: "POST", token });
}

export async function getNotificationPreferences(
  token: string,
): Promise<NotificationPreferences> {
  return request<NotificationPreferences>("/notifications/preferences", { token });
}

export async function updateNotificationPreferences(
  token: string,
  patch: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  return request<NotificationPreferences>("/notifications/preferences", {
    method: "PATCH",
    token,
    json: patch,
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

// --- bucket list ---------------------------------------------------------
export type BucketStatus = "planned" | "in_progress" | "done";

export interface BucketItem {
  id: string;
  title: string;
  category: string | null;
  target_visit_id: string | null;
  status: BucketStatus;
  notes: string | null;
}

export interface BucketItemInput {
  title: string;
  category?: string | null;
  target_visit_id?: string | null;
  notes?: string | null;
}

export async function listBucketItems(token: string): Promise<BucketItem[]> {
  return request<BucketItem[]>("/bucket-items", { token });
}

export async function createBucketItem(
  token: string,
  input: BucketItemInput,
): Promise<BucketItem> {
  return request<BucketItem>("/bucket-items", { method: "POST", token, json: input });
}

export async function updateBucketItem(
  token: string,
  id: string,
  patch: Partial<BucketItemInput & { status: BucketStatus }>,
): Promise<BucketItem> {
  return request<BucketItem>(`/bucket-items/${id}`, { method: "PATCH", token, json: patch });
}
