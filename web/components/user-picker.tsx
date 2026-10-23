"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { api, type PickerRole, type PickerUser } from "@/lib/api";
import { avatarColour, initial } from "@/lib/format";
import { useUser } from "@/lib/user-context";
import { cn } from "@/lib/utils";

/**
 * Stands in for sign-in. Every request after this carries the picked id as x-user-id. Drawn like the canvas's "Viewing as" select.
 * `compact` is the phone header: a 36px initial with the native select laid invisibly over it.
 */
export function UserPicker({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  const { userId, setUserId, ready } = useUser();
  const users = useQuery({ queryKey: ["users"], queryFn: api.users, staleTime: 60_000 });
  const picked = users.data?.users.find((u) => u.id === userId);
  const known = !!picked;

  const all = users.data?.users ?? [];
  const starters = { host: all.find((u) => u.role === "host"), booker: all.find((u) => u.role === "booker") };
  const group = (role: PickerRole) => all.filter((u) => u.role === role);
  const detail = (u: PickerUser) => (u.role === "host" ? `hosts ${u.hosting}` : u.role === "guest" ? `guest, gen ${u.generation}` : `going to ${u.going}`);

  const options = (
    <>
      <optgroup label="Start here">
        {starters.host && <option value={starters.host.id}>Host · {starters.host.displayName}</option>}
        {starters.booker && <option value={starters.booker.id}>Booker · {starters.booker.displayName}</option>}
        <option value="">Guest · nobody yet</option>
      </optgroup>
      {(["host", "booker", "guest"] as const).map((role) =>
        group(role).length === 0 ? null : (
          <optgroup key={role} label={role === "host" ? "Hosts" : role === "booker" ? "Bookers" : "Guests"}>
            {group(role).map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName} · {detail(u)}
              </option>
            ))}
          </optgroup>
        ),
      )}
      {ready && userId && !known && <option value={userId}>Guest · you</option>}
    </>
  );

  if (compact) {
    const name = picked?.displayName ?? (ready && userId ? "Guest" : "");
    return (
      <span className="relative inline-flex size-9 items-center justify-center">
        <span aria-hidden="true" className={cn("flex size-9 items-center justify-center rounded-full text-sm font-bold", name ? "text-white" : "border-[1.5px] border-dashed border-[#C9CDD3] text-muted-ink")} style={name ? { background: avatarColour(name) } : undefined}>
          {name ? initial(name) : "?"}
        </span>
        <select aria-label="Viewing as" className="absolute inset-0 cursor-pointer opacity-0" value={ready && userId ? userId : ""} onChange={(e) => setUserId(e.target.value || null)}>
          {options}
        </select>
      </span>
    );
  }

  // The closed control shows only the name; the native menu underneath carries the groups and details.
  const label = picked ? `${picked.displayName} · ${picked.role}` : ready && userId ? "Guest" : "Nobody yet";
  return (
    <label className={cn("flex items-center gap-2.5 text-sm", dark ? "text-[#C5CAD1]" : "text-muted-ink")}>
      <span className="hidden md:inline">Viewing as</span>
      <span className="relative inline-flex">
        <span
          aria-hidden="true"
          className={cn(
            "flex h-10 min-w-[120px] items-center rounded-[10px] pl-3 pr-9 text-sm font-semibold",
            dark ? "border border-[#3D424A] bg-[#23262B] text-white" : "border-[1.5px] border-[#C9CDD3] bg-surface text-ink",
          )}
        >
          {label}
        </span>
        <select aria-label="Viewing as" className="absolute inset-0 cursor-pointer opacity-0" value={ready && userId ? userId : ""} onChange={(e) => setUserId(e.target.value || null)}>
          {options}
        </select>
        <ChevronDown className={cn("pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2", dark ? "text-[#C5CAD1]" : "text-muted-ink")} />
      </span>
    </label>
  );
}
