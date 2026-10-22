import { ApiError, type ErrorCode } from "./errors";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type Money = { amountMinor: number; currency: string };

export type Person = { id: string; displayName: string };

export type Viewer = {
  bookingId: string;
  planId: string;
  planRole: "owner" | "member";
  joinedVia: "direct" | "vouch" | "public";
};

export type Activity = {
  id: string;
  title: string;
  description: string;
  category: "outdoors" | "nights_out" | "food_and_drink" | "classes" | "other";
  illustration: "kayak" | "hike" | "speakeasy" | "salsa" | "market" | "pottery" | "other";
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
  photos: { id: string; url: string; position: number }[];
  plansCount: number;
  invitesEnabled: boolean;
  viewer: Viewer | null;
  createdAt: string;
};

export type Member = {
  userId: string;
  displayName: string;
  role: "owner" | "member";
  joinedVia: "direct" | "vouch" | "public";
  invitedBy: Person | null;
  joinedAt: string;
};

export type Plan = {
  id: string;
  activityId: string;
  owner: Person;
  members: Member[];
  membersCount: number;
  createdAt: string;
};

export type InviteStatus = "open" | "expired" | "used" | "revoked" | "started" | "off";

export type ResolvedInvite = {
  code: string;
  codeDisplay: string;
  rail: "vouch" | "public";
  isHostInvite: boolean;
  status: InviteStatus;
  inviter: Person;
  activity: Omit<Activity, "viewer">;
  plan: Plan | null;
  expiresAt: string;
  viewer: { alreadyInPlan: boolean; bookingId: string; planId: string } | null;
};

export type User = {
  id: string;
  displayName: string;
  generation: number;
  remindDayBefore: boolean;
  friendUpdates: boolean;
  hasContact: boolean;
  createdAt: string;
};

export type PickerUser = { id: string; displayName: string; generation: number; isHost: boolean };

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

export const api = {
  health: () => apiRequest<{ ok: boolean; postgres: string; redis: string }>("/health"),
  users: () => apiRequest<{ users: PickerUser[] }>("/users"),
  me: (userId: string) => apiRequest<{ user: User }>("/me", { userId }),
  activities: (params: URLSearchParams | Record<string, string> = {}, userId?: string | null) =>
    apiRequest<{ activities: Activity[] }>(`/activities${queryString(params)}`, { userId }),
  activity: (id: string, userId?: string | null, anonId?: string) =>
    apiRequest<{ activity: Activity }>(`/activities/${id}${anonId ? `?anonId=${encodeURIComponent(anonId)}` : ""}`, { userId }),
  invite: (code: string, userId?: string | null) =>
    apiRequest<ResolvedInvite>(`/invites/${encodeURIComponent(code)}`, { userId }),
};

function queryString(params: URLSearchParams | Record<string, string>) {
  const search = params instanceof URLSearchParams ? params : new URLSearchParams(params);
  const s = search.toString();
  return s ? `?${s}` : "";
}
