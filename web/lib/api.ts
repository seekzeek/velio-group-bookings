import { ApiError, type ErrorCode } from "./errors";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type Money = { amountMinor: number; currency: string };
export type Person = { id: string; displayName: string };
export type Rail = "vouch" | "public";
export type JoinedVia = "direct" | Rail;
export type Category = "outdoors" | "nights_out" | "food_and_drink" | "classes" | "other";
export type Illustration = "kayak" | "hike" | "speakeasy" | "salsa" | "market" | "pottery" | "other";

export type Viewer = { bookingId: string; planId: string; planRole: "owner" | "member"; joinedVia: JoinedVia };

export type Photo = { id: string; url: string; position: number };

export type Activity = {
  id: string;
  title: string;
  description: string;
  category: Category;
  illustration: Illustration;
  location: string;
  startsAt: string;
  timezone: string;
  price: Money;
  capacity: number;
  spotsTaken: number;
  spotsLeft: number;
  version: number;
  status: "open" | "full" | "started";
  host: Person;
  photos: Photo[];
  plansCount: number;
  invitesEnabled: boolean;
  viewer: Viewer | null;
  createdAt: string;
};

export type Member = { userId: string; displayName: string; role: "owner" | "member"; joinedVia: JoinedVia; invitedBy: Person | null; joinedAt: string };

export type Plan = { id: string; activityId: string; owner: Person; members: Member[]; membersCount: number; createdAt: string };

export type InviteStatus = "open" | "expired" | "used" | "revoked" | "started" | "off";

export type ResolvedInvite = {
  code: string;
  codeDisplay: string;
  rail: Rail;
  isHostInvite: boolean;
  status: InviteStatus;
  inviter: Person;
  activity: Omit<Activity, "viewer">;
  plan: Plan | null;
  expiresAt: string;
  viewer: { alreadyInPlan: boolean; bookingId: string; planId: string } | null;
};

export type InviterInviteStatus = "not_opened" | "opened" | "opened_when_full" | "joined" | "expired" | "revoked" | "active";

export type Invite = {
  id: string;
  code: string;
  codeDisplay: string;
  url: string;
  rail: Rail;
  activityId: string;
  planId: string | null;
  isHostInvite: boolean;
  recipientLabel: string | null;
  status: InviterInviteStatus;
  opensCount: number;
  firstOpenedAt: string | null;
  lastOpenSpotsLeft: number | null;
  joinedCount: number;
  joinedAt: string | null;
  invitee: { displayName: string; wasNew: boolean } | null;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
};

export type User = { id: string; displayName: string; generation: number; remindDayBefore: boolean; friendUpdates: boolean; hasContact: boolean; createdAt: string };
export type PickerUser = { id: string; displayName: string; generation: number; isHost: boolean };

export type BookingResult = { booking: { id: string; status: string; createdAt: string }; plan: Plan; activity: Activity; replayed: boolean };
export type ClaimResult = BookingResult & { userId: string; isNewUser: boolean; generation: number };

export type AttendanceTotals = { booked: number; capacity: number; spotsLeft: number; version: number; plansCount: number; groupsOfTwoOrMore: number; viaInvites: { total: number; vouch: number; public: number } };
export type Attendance = { activity: Activity; totals: AttendanceTotals; plans: (Plan & { latestJoinAt: string })[] };

export type MyPlans = {
  going: { plan: Plan; activity: Activity; viewerRole: "owner" | "member"; viewerJoinedVia: JoinedVia; pendingVouches: number }[];
  hosting: { activity: Activity; attendance: { plansCount: number; groupsOfTwoOrMore: number; viaInvites: { total: number; vouch: number; public: number } } }[];
  past: MyPlans["going"];
};

export type MyInvites = {
  summary: { sent: number; vouches: number; links: number; joined: number; joinedNew: number; waiting: number; missed: number };
  activities: { activity: Activity; planId: string | null; viewerGroupSize: number; invites: Invite[] }[];
};

export type Goal = { key: string; label: string; current: number | null; currentDisplay: string; target: number; targetDisplay: string; trigger: string; status: "on_target" | "trigger_fired" | "no_data"; sampleSize: number; minSample: number };
export type HealthReport = {
  source: "live" | "scenario";
  scenarioAvailable: boolean;
  generatedAt: string;
  window: { from: string; to: string; days: number };
  goals: Goal[];
  triggers: { goalKey: string; message: string }[];
  claimRateByRail: { vouch: number | null; public: number | null; opens: { vouch: number; public: number }; definition: string };
  opensOnFullShare: number | null;
  byPlatform: { platform: string; views: number; bookingAttempts: number; bookings: number; inviteOpens: number; claims: number }[];
  holdout: { holdoutPercent: number; weeksElapsed: number; weeksPlanned: number; note: string; summary: { variant: string; activities: number; avgAttendees: number; avgFillRate: number; avgNewUsers: number; bookingsPerView: number | null; avgGroupPlans: number }[] };
  diagnosisQueries: { title: string; sql: string }[];
};

export type ClientEventName = "activity_viewed" | "invite_opened" | "claim_started" | "claim_submitted" | "invite_link_copied" | "invite_link_shared" | "invite_nudged" | "invite_missed";

type RequestOptions = { method?: string; body?: unknown; userId?: string | null; signal?: AbortSignal };

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.userId) headers["x-user-id"] = options.userId;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError("TRY_AGAIN", "We couldn't reach Velio. Check your connection and try again.", 0);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const json = text ? safeJson(text) : null;
  if (!res.ok) {
    const error = (json as { error?: { code?: string; message?: string; details?: Record<string, unknown> } } | null)?.error;
    throw new ApiError((error?.code as ErrorCode) ?? "TRY_AGAIN", error?.message, res.status, error?.details);
  }
  return json as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function queryString(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") search.set(k, String(v));
  const s = search.toString();
  return s ? `?${s}` : "";
}

export type ActivityFilters = { category?: Category; hostId?: string; sort?: "soonest" | "filling" | "price"; minSpotsLeft?: number; until?: string; excludeId?: string; includePast?: boolean };

export const api = {
  health: () => apiRequest<{ ok: boolean; postgres: string; redis: string }>("/health"),
  users: () => apiRequest<{ users: PickerUser[] }>("/users"),
  me: (userId: string) => apiRequest<{ user: User }>("/me", { userId }),
  updatePreferences: (userId: string, body: { remindDayBefore?: boolean; friendUpdates?: boolean }) =>
    apiRequest<{ user: User }>("/me/preferences", { method: "PATCH", body, userId }),
  activities: (filters: ActivityFilters = {}, userId?: string | null) =>
    apiRequest<{ activities: Activity[] }>(`/activities${queryString(filters)}`, { userId }),
  activity: (id: string, userId?: string | null, anonId?: string) =>
    apiRequest<{ activity: Activity }>(`/activities/${id}${queryString({ anonId })}`, { userId }),
  createActivity: (userId: string, body: unknown) => apiRequest<{ activity: Activity }>("/activities", { method: "POST", body, userId }),
  updateActivity: (userId: string, id: string, body: unknown) => apiRequest<{ activity: Activity }>(`/activities/${id}`, { method: "PATCH", body, userId }),
  attendance: (userId: string, id: string) => apiRequest<Attendance>(`/activities/${id}/attendance`, { userId }),
  watch: (id: string, body: { anonId?: string; contact?: string; platform: "web" }, userId?: string | null) =>
    apiRequest<{ watching: boolean }>(`/activities/${id}/watch`, { method: "POST", body, userId }),
  book: (userId: string, activityId: string, body: { idempotencyKey: string; platform: "web"; anonId?: string }) =>
    apiRequest<BookingResult>(`/activities/${activityId}/bookings`, { method: "POST", body, userId }),
  createInvite: (userId: string, body: { rail: Rail; activityId: string; recipientContact?: string; recipientLabel?: string; platform: "web" }) =>
    apiRequest<{ invite: Invite; created: boolean }>("/invites", { method: "POST", body, userId }),
  invite: (code: string, userId?: string | null) => apiRequest<ResolvedInvite>(`/invites/${encodeURIComponent(code)}`, { userId }),
  claim: (code: string, body: { idempotencyKey: string; displayName?: string; contact?: string; platform: "web"; anonId?: string }, userId?: string | null) =>
    apiRequest<ClaimResult>(`/invites/${encodeURIComponent(code)}/claim`, { method: "POST", body, userId }),
  revokeInvite: (userId: string, code: string) => apiRequest<{ invite: Invite }>(`/invites/${code}/revoke`, { method: "POST", body: { reason: "turned_off" }, userId }),
  myPlans: (userId: string, includePast = false) => apiRequest<MyPlans>(`/me/plans${queryString({ includePast: includePast || undefined })}`, { userId }),
  plan: (userId: string, id: string) => apiRequest<{ plan: Plan; activity: Activity }>(`/plans/${id}`, { userId }),
  myInvites: (userId: string, activityId?: string) => apiRequest<MyInvites>(`/me/invites${queryString({ activityId })}`, { userId }),
  event: (body: { name: ClientEventName; anonId: string; platform: "web"; activityId?: string; inviteCode?: string; props?: Record<string, unknown> }, userId?: string | null) =>
    apiRequest<Record<string, never>>("/events", { method: "POST", body, userId }),
  adminHealth: (params: { source?: "live" | "scenario"; minSample?: number; windowDays?: number } = {}) =>
    apiRequest<HealthReport>(`/admin/health${queryString(params)}`),
  uploadPhoto: async (userId: string, activityId: string, file: File, onProgress?: (fraction: number) => void) => {
    return new Promise<{ photo: Photo }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE_URL}/activities/${activityId}/photos`);
      xhr.setRequestHeader("x-user-id", userId);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
      };
      xhr.onload = () => {
        const json = safeJson(xhr.responseText) as { photo?: Photo; error?: { code?: string; message?: string } } | null;
        if (xhr.status >= 200 && xhr.status < 300 && json?.photo) resolve({ photo: json.photo });
        else reject(new ApiError((json?.error?.code as ErrorCode) ?? "TRY_AGAIN", json?.error?.message, xhr.status));
      };
      xhr.onerror = () => reject(new ApiError("TRY_AGAIN", "The upload didn't go through.", 0));
      const form = new FormData();
      form.append("photo", file);
      xhr.send(form);
    });
  },
  deletePhoto: (userId: string, activityId: string, photoId: string) => apiRequest<void>(`/activities/${activityId}/photos/${photoId}`, { method: "DELETE", userId }),
  reorderPhotos: (userId: string, activityId: string, photoIds: string[]) => apiRequest<{ photos: Photo[] }>(`/activities/${activityId}/photos/order`, { method: "PUT", body: { photoIds }, userId }),
};
