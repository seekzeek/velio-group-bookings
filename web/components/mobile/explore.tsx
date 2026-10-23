"use client";

import Link from "next/link";
import { ErrorState, Skeleton, TextButton } from "@/components/bits";
import { Cover } from "@/components/cover";
import type { Activity } from "@/lib/api";
import type { ErrorCode } from "@/lib/errors";
import { formatMoney, formatWhen, isFillingFast, spotsText } from "@/lib/format";
import { Bar, DotLine, H1, LiveTag, Pill, PillRow, Screen, Tick } from "./bits";

type Props<F extends string> = {
  rows: Activity[] | undefined;
  pending: boolean;
  error: ErrorCode | null;
  onRetry: () => void;
  filters: { key: F; label: string }[];
  active: F[];
  toggle: (key: F) => void;
};

/** Explore as the phone draws it: the title, filter pills, one featured card, then rows. Every card opens the activity. */
export function MobileExplore<F extends string>({ rows, pending, error, onRetry, filters, active, toggle }: Props<F>) {
  return (
    <Screen>
      <div className="px-5 pt-5">
        <H1>What are you doing this week?</H1>
      </div>
      <PillRow>
        {filters.map((f) => (
          <Pill key={f.key} pressed={active.includes(f.key)} onClick={() => toggle(f.key)}>
            {f.label}
          </Pill>
        ))}
      </PillRow>
      <div className="flex flex-col gap-3 px-5 py-4">
        {pending && (
          <>
            <Skeleton className="h-[260px] rounded-[20px]" />
            <Skeleton className="h-24 rounded-[20px]" />
            <Skeleton className="h-24 rounded-[20px]" />
          </>
        )}
        {error && <ErrorState code={error} action={<TextButton onClick={onRetry}>Try again</TextButton>} />}
        {rows?.map((a, i) => (i === 0 ? <Featured key={a.id} activity={a} /> : <Row key={a.id} activity={a} />))}
        {rows && rows.length === 0 && <p className="text-body">Nothing matches those filters yet. Try another one.</p>}
      </div>
    </Screen>
  );
}

function Going() {
  return (
    <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-brand-tint px-2.5 py-[5px] text-[13px] font-bold text-brand-deep">
      <Tick size={14} /> You&apos;re going
    </span>
  );
}

function Featured({ activity: a }: { activity: Activity }) {
  const booked = a.viewer !== null;
  return (
    <Link href={`/activities/${a.id}`} className="flex flex-col overflow-hidden rounded-[20px] bg-surface text-ink shadow-[var(--shadow-card)]">
      <span className="relative block h-[170px]">
        <Cover illustration={a.illustration} photos={a.photos} />
        {isFillingFast(a.spotsLeft, a.capacity) && !booked && <span className="absolute bottom-3 left-3 rounded-full bg-ink px-[9px] py-[5px] text-[11px] font-bold uppercase tracking-[0.06em] text-white">Filling fast</span>}
      </span>
      <span className="flex flex-col gap-1.5 px-4 pb-4 pt-3.5">
        <span className="flex items-baseline justify-between gap-2">
          <span className="font-heading text-[22px] font-bold tracking-[-0.02em]">{a.title}</span>
          <span className="text-base font-bold">{formatMoney(a.price)}</span>
        </span>
        <span className="text-[13px] text-muted-ink">
          {formatWhen(a.startsAt, a.timezone)} · {a.location} · {a.host.displayName}
        </span>
        <span className="mt-1 flex flex-col gap-1.5 border-t border-[#EEF0F2] pt-2.5">
          {booked ? (
            <Going />
          ) : (
            <>
              <span className="flex items-center justify-between">
                <DotLine spotsLeft={a.spotsLeft} text={spotsText(a.spotsLeft, a.capacity, true)} />
                <LiveTag />
              </span>
              <Bar spotsLeft={a.spotsLeft} capacity={a.capacity} />
            </>
          )}
        </span>
      </span>
    </Link>
  );
}

function Row({ activity: a }: { activity: Activity }) {
  const booked = a.viewer !== null;
  return (
    <Link href={`/activities/${a.id}`} className="flex gap-3.5 rounded-[20px] bg-surface p-3 text-ink shadow-[var(--shadow-card)]">
      <span className="block size-[72px] shrink-0 overflow-hidden rounded-xl">
        <Cover illustration={a.illustration} photos={a.photos} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1 py-0.5 pr-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate font-heading text-[17px] font-bold tracking-[-0.01em]">{a.title}</span>
          <span className="text-[15px] font-bold">{formatMoney(a.price)}</span>
        </span>
        <span className="text-[13px] text-muted-ink">
          {formatWhen(a.startsAt, a.timezone)} · {a.host.displayName}
        </span>
        <span className="mt-auto flex items-center justify-between">
          {booked ? (
            <Going />
          ) : (
            <>
              <DotLine spotsLeft={a.spotsLeft} text={spotsText(a.spotsLeft, a.capacity, true)} />
              <LiveTag />
            </>
          )}
        </span>
      </span>
    </Link>
  );
}
