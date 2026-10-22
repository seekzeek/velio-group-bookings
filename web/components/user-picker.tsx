"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useUser } from "@/lib/user-context";

/** Stands in for sign-in. Every request after this carries the picked id as x-user-id. */
export function UserPicker({ className }: { className?: string }) {
  const { userId, setUserId, ready } = useUser();
  const users = useQuery({ queryKey: ["users"], queryFn: api.users, staleTime: 60_000 });
  const known = users.data?.users.some((u) => u.id === userId);
  return (
    <label className={`flex items-center gap-2 text-sm font-semibold text-muted-ink ${className ?? ""}`}>
      <span className="hidden sm:inline">Viewing as</span>
      <select
        aria-label="Viewing as"
        className="h-9 rounded-xl border border-line bg-surface px-3 text-sm font-semibold text-ink"
        value={ready && userId ? userId : ""}
        onChange={(e) => setUserId(e.target.value || null)}
      >
        <option value="">Nobody yet</option>
        {users.data?.users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.displayName} · {u.isHost ? "host" : "booker"}
          </option>
        ))}
        {ready && userId && !known && <option value={userId}>Guest · you</option>}
      </select>
    </label>
  );
}
