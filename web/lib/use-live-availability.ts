"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { API_BASE_URL, type Activity } from "./api";

export type AvailabilityMessage = { activityId: string; spotsTaken: number; capacity: number; spotsLeft: number; version: number; at: string };

export type LiveState = { connected: boolean; lastChange: AvailabilityMessage | null };

/**
 * Opens the activity's SSE stream and keeps the TanStack cache for ["activity", id] in step with it.
 * Messages with a version at or below the one we hold are ignored. A heartbeat with a newer version means
 * something was missed, so the activity is refetched. If the stream can't connect, polling takes over.
 */
export function useLiveAvailability(activityId: string | null): LiveState {
  const queryClient = useQueryClient();
  const [state, setState] = useState<LiveState>({ connected: false, lastChange: null });
  const versionRef = useRef(0);

  useEffect(() => {
    if (!activityId) return;
    const cached = queryClient.getQueryData<{ activity: Activity }>(["activity", activityId]);
    versionRef.current = cached?.activity.version ?? 0;

    const source = new EventSource(`${API_BASE_URL}/activities/${activityId}/stream`);
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const apply = (message: AvailabilityMessage, announce: boolean) => {
      if (message.version <= versionRef.current) return;
      const previous = versionRef.current;
      versionRef.current = message.version;
      queryClient.setQueryData<{ activity: Activity }>(["activity", activityId], (old) =>
        old ? { activity: { ...old.activity, spotsTaken: message.spotsTaken, capacity: message.capacity, spotsLeft: message.spotsLeft, version: message.version, status: old.activity.status === "started" ? "started" : message.spotsLeft === 0 ? "full" : "open" } } : old,
      );
      if (announce && previous > 0) setState((s) => ({ ...s, lastChange: message }));
    };

    source.addEventListener("availability", (e) => apply(JSON.parse((e as MessageEvent).data) as AvailabilityMessage, true));
    source.addEventListener("heartbeat", (e) => {
      const { version } = JSON.parse((e as MessageEvent).data) as { version: number };
      if (version > versionRef.current) {
        versionRef.current = version;
        void queryClient.invalidateQueries({ queryKey: ["activity", activityId] });
      }
    });
    source.onopen = () => {
      setState((s) => ({ ...s, connected: true }));
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };
    source.onerror = () => {
      setState((s) => ({ ...s, connected: false }));
      if (!pollTimer) pollTimer = setInterval(() => void queryClient.invalidateQueries({ queryKey: ["activity", activityId] }), 10_000);
    };

    return () => {
      source.close();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [activityId, queryClient]);

  return state;
}
