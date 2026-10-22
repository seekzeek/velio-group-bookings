import { api, type ClientEventName } from "./api";

// Fire and forget. Analytics must never break a screen.
export function track(input: { name: ClientEventName; anonId: string; userId?: string | null; activityId?: string; inviteCode?: string; props?: Record<string, unknown> }) {
  if (!input.anonId) return;
  api.event({ name: input.name, anonId: input.anonId, platform: "web", activityId: input.activityId, inviteCode: input.inviteCode, props: input.props }, input.userId).catch(() => undefined);
}
