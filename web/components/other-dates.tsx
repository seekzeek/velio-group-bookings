"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatMoney, formatWhen } from "@/lib/format";

/** "Same host, other dates": the host's other upcoming activities that still have room. */
export function OtherDates({ hostId, excludeId, label }: { hostId: string; excludeId: string; label?: string }) {
  const others = useQuery({ queryKey: ["activities", { hostId, excludeId }], queryFn: () => api.activities({ hostId, excludeId }) });
  const rows = others.data?.activities.filter((a) => a.spotsLeft > 0).slice(0, 3) ?? [];
  if (rows.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {label && <span className="text-sm font-bold text-ink">{label}</span>}
      {rows.map((a) => (
        <Link key={a.id} href={`/activities/${a.id}`} className="flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
          <span className="flex flex-col">
            <span className="font-bold text-ink">{a.title}</span>
            <span className="text-body">
              {formatWhen(a.startsAt, a.timezone)} · {formatMoney(a.price)}
            </span>
          </span>
          <span className="font-bold text-brand-deep">{a.spotsLeft} left</span>
        </Link>
      ))}
    </div>
  );
}
