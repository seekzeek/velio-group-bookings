"use client";

import Link from "next/link";
import { useState } from "react";
import type { Activity } from "@/lib/api";
import { api } from "@/lib/api";
import { categoryLabels, formatMoney, formatWhen } from "@/lib/format";
import { useUser } from "@/lib/user-context";
import { Button, ButtonLink } from "./bits";
import { Cover } from "./cover";
import { SpotsLine } from "./spots-line";

/** An Explore card exactly as the canvas draws it: cover with the category badge bottom-left, then one of open, full or booked. */
export function ActivityCard({ activity }: { activity: Activity }) {
  const { userId, anonId } = useUser();
  const [watching, setWatching] = useState(false);
  const href = `/activities/${activity.id}`;
  const booked = activity.viewer !== null;
  const full = activity.spotsLeft <= 0 && !booked;

  return (
    <article className="flex flex-col overflow-hidden rounded-[20px] bg-surface shadow-[var(--shadow-card)]">
      <Link href={href} className="relative block h-[170px]">
        <Cover illustration={activity.illustration} photos={activity.photos} />
        <span className="pointer-events-none absolute bottom-3.5 left-3.5 rounded-full bg-surface px-2.5 py-[5px] text-xs font-bold text-ink">{categoryLabels[activity.category]}</span>
      </Link>
      <div className="flex flex-1 flex-col gap-2.5 px-5 pb-5 pt-[18px]">
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
          <div className="mt-auto flex items-center justify-between gap-3 rounded-[14px] bg-brand-tint px-3.5 py-3">
            <span className="inline-flex items-center gap-2 text-[15px] font-bold text-brand-deep">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              You&apos;re going
            </span>
            <ButtonLink href={`${href}#invite`} size="nav">
              Invite friends
            </ButtonLink>
          </div>
        ) : (
          <div className="mt-auto flex flex-col gap-3 pt-1">
            <SpotsLine spotsLeft={activity.spotsLeft} capacity={activity.capacity} short size="card" />
            {full ? (
              <Button
                size="card"
                variant={watching ? "tint" : "outline"}
                block
                onClick={() => {
                  setWatching(true);
                  api.watch(activity.id, { anonId, platform: "web" }, userId).catch(() => undefined);
                }}
              >
                {watching ? "We'll tell you if a spot opens" : "Tell me if a spot opens"}
              </Button>
            ) : (
              <ButtonLink href={href} size="card" block>
                Book a spot
              </ButtonLink>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
