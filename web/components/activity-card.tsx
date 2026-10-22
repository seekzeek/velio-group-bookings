"use client";

import Link from "next/link";
import { useState } from "react";
import type { Activity } from "@/lib/api";
import { api } from "@/lib/api";
import { categoryLabels, formatMoney, formatWhen, isFillingFast } from "@/lib/format";
import { useUser } from "@/lib/user-context";
import { Cover } from "./cover";
import { SpotsLine } from "./spots-line";
import { SecondaryButton } from "./bits";

export function ActivityCard({ activity, onBook }: { activity: Activity; onBook?: (activity: Activity) => void }) {
  const { userId, anonId } = useUser();
  const [watching, setWatching] = useState(false);
  const href = `/activities/${activity.id}`;
  const booked = activity.viewer !== null;
  const full = activity.spotsLeft <= 0 && !booked;

  return (
    <article className="flex flex-col overflow-hidden rounded-[20px] bg-surface shadow-[var(--shadow-card)]">
      <Link href={href} className="relative block h-[170px]">
        <Cover illustration={activity.illustration} photos={activity.photos} />
        <span className="absolute left-3 top-3 rounded-full bg-surface/95 px-2.5 py-1 text-xs font-bold text-ink">{categoryLabels[activity.category]}</span>
        {isFillingFast(activity.spotsLeft, activity.capacity) && !booked && (
          <span className="absolute right-3 top-3 rounded-full bg-warning-bg px-2.5 py-1 text-xs font-bold text-warning-text">Filling fast</span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <Link href={href} className="text-lg font-bold leading-tight text-ink">
            {activity.title}
          </Link>
          <span className="whitespace-nowrap font-bold text-ink">{formatMoney(activity.price)}</span>
        </div>
        <span className="text-sm text-body">
          {formatWhen(activity.startsAt, activity.timezone)} · {activity.host.displayName}
        </span>
        {booked ? (
          <div className="mt-auto flex items-center justify-between pt-2">
            <span className="inline-flex items-center gap-2 text-[15px] font-bold text-brand-deep">
              <span className="size-2 rounded-full bg-brand" /> You&apos;re going
            </span>
            <Link href={`${href}#invite`} className="text-sm font-bold text-brand">
              Invite friends
            </Link>
          </div>
        ) : (
          <div className="mt-auto flex flex-col gap-3 pt-2">
            <SpotsLine spotsLeft={activity.spotsLeft} capacity={activity.capacity} short />
            {full ? (
              <SecondaryButton
                active={watching}
                onClick={() => {
                  setWatching(true);
                  api.watch(activity.id, { anonId, platform: "web" }, userId).catch(() => undefined);
                }}
              >
                {watching ? "We'll tell you if a spot opens" : "Tell me if a spot opens"}
              </SecondaryButton>
            ) : onBook ? (
              <button onClick={() => onBook(activity)} className="flex h-12 w-full items-center justify-center rounded-2xl bg-brand text-[15px] font-bold text-white">
                Book a spot
              </button>
            ) : (
              <Link href={href} className="flex h-12 w-full items-center justify-center rounded-2xl bg-brand text-[15px] font-bold text-white">
                Book a spot
              </Link>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
