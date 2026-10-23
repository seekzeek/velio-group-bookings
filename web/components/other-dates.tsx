"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatMoney, formatWhen } from "@/lib/format";
import { Dot, Eyebrow } from "./bits";

/** "Same host, other dates": the host's other upcoming activities that still have room, as white rows with the dot. */
export function OtherDates({ hostId, excludeId, label }: { hostId: string; excludeId: string; label?: string }) {
  const others = useQuery({ queryKey: ["activities", { hostId, excludeId }], queryFn: () => api.activities({ hostId, excludeId }) });
  const rows = others.data?.activities.filter((a) => a.spotsLeft > 0).slice(0, 3) ?? [];
  if (rows.length === 0) return null;
  return (
    <div className="flex flex-col gap-2.5">
      {label && <Eyebrow>{label}</Eyebrow>}
      {rows.map((a) => (
        <Link key={a.id} href={`/activities/${a.id}`} className="flex min-h-11 items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3.5 text-ink shadow-[var(--shadow-card)]">
          <span className="flex flex-col">
            <span className="font-bold">{a.title}</span>
            <span className="text-sm text-body">
              {formatWhen(a.startsAt, a.timezone)} · {formatMoney(a.price)}
            </span>
          </span>
          <span className="inline-flex items-center gap-2 text-sm font-bold text-brand-deep">
            <Dot spotsLeft={a.spotsLeft} /> {a.spotsLeft} left
          </span>
        </Link>
      ))}
    </div>
  );
}
