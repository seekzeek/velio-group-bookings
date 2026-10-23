"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { api } from "@/lib/api";
import { useUser } from "@/lib/user-context";
import { cn } from "@/lib/utils";

/** Stands in for sign-in. Every request after this carries the picked id as x-user-id. Drawn like the canvas's "Viewing as" select. */
export function UserPicker({ dark = false }: { dark?: boolean }) {
  const { userId, setUserId, ready } = useUser();
  const users = useQuery({ queryKey: ["users"], queryFn: api.users, staleTime: 60_000 });
  const known = users.data?.users.some((u) => u.id === userId);
  return (
    <label className={cn("flex items-center gap-2.5 text-sm", dark ? "text-[#C5CAD1]" : "text-muted-ink")}>
      <span className="hidden md:inline">Viewing as</span>
      <span className="relative inline-flex">
        <select
          aria-label="Viewing as"
          className={cn(
            "h-10 cursor-pointer appearance-none rounded-[10px] pl-3 pr-9 text-sm font-semibold outline-none",
            dark ? "border border-[#3D424A] bg-[#23262B] text-white" : "border-[1.5px] border-[#C9CDD3] bg-surface text-ink focus:border-brand",
          )}
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
        <ChevronDown className={cn("pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2", dark ? "text-[#C5CAD1]" : "text-muted-ink")} />
      </span>
    </label>
  );
}
