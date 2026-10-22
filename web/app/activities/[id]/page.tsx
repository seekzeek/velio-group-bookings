"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { Card, CardSkeleton, Cta, ErrorState, Notice, SecondaryButton, Spinner, Toast } from "@/components/bits";
import { Cover } from "@/components/cover";
import { OtherDates } from "@/components/other-dates";
import { InvitePanel } from "@/components/invite-panel";
import { PageShell } from "@/components/page-shell";
import { SpotsLine } from "@/components/spots-line";
import { api, type Activity } from "@/lib/api";
import { isApiError, type ErrorCode } from "@/lib/errors";
import { track } from "@/lib/events";
import { formatDay, formatMoney, formatTime, formatWhen, listNames } from "@/lib/format";
import { useLiveAvailability } from "@/lib/use-live-availability";
import { useUser } from "@/lib/user-context";
import { downloadCalendar } from "@/lib/calendar";

export default function ActivityPage() {
  const { id } = useParams<{ id: string }>();
  const { userId, anonId, ready } = useUser();
  const queryClient = useQueryClient();
  const [soldOut, setSoldOut] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);
  const [added, setAdded] = useState(false);
  const ownVersion = useRef(0);

  const query = useQuery({ queryKey: ["activity", id], queryFn: () => api.activity(id, userId, anonId), enabled: ready });
  const live = useLiveAvailability(ready ? id : null);
  const activity = query.data?.activity;
  const planId = activity?.viewer?.planId ?? null;
  const plan = useQuery({ queryKey: ["plan", planId, userId], queryFn: () => api.plan(userId!, planId!), enabled: !!planId && !!userId });
  const others = plan.data?.plan.members.filter((m) => m.userId !== userId).map((m) => m.displayName) ?? [];

  useEffect(() => {
    if (activity && anonId) track({ name: "activity_viewed", anonId, userId, activityId: activity.id, props: { fromInvite: false } });
    // Track once per activity id, not on every live count change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity?.id, anonId]);

  useEffect(() => {
    const change = live.lastChange;
    if (!change || change.version <= ownVersion.current) return;
    const left = change.spotsLeft;
    setToast(left === 0 ? "Someone just booked · now full" : `Someone just booked · ${left} ${left === 1 ? "spot" : "spots"} left`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.lastChange?.version]);

  const book = useMutation({
    mutationFn: () => api.book(userId!, id, { idempotencyKey: crypto.randomUUID(), platform: "web", anonId }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["activity", id] });
      queryClient.setQueryData<{ activity: Activity }>(["activity", id], (old) => (old ? { activity: { ...old.activity, spotsTaken: old.activity.spotsTaken + 1, spotsLeft: old.activity.spotsLeft - 1 } } : old));
    },
    onSuccess: (result) => {
      setSoldOut(false);
      ownVersion.current = result.activity.version;
      queryClient.setQueryData(["activity", id], { activity: result.activity });
      void queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
    onError: (err) => {
      void queryClient.invalidateQueries({ queryKey: ["activity", id] });
      if (isApiError(err, "SOLD_OUT")) setSoldOut(true);
      else if (isApiError(err, "ALREADY_BOOKED")) void queryClient.invalidateQueries({ queryKey: ["activity", id] });
      else if (isApiError(err)) setToast(isApiError(err, "UNAUTHENTICATED") ? "Pick who you are at the top of the page first." : err.message);
      else setToast("Something went wrong on our side. Nothing was booked.");
    },
  });

  const onBook = useCallback(() => {
    if (!userId) return setToast("Pick who you are at the top of the page first.");
    book.mutate();
  }, [book, userId]);

  if (query.isError) {
    return (
      <PageShell>
        <ErrorState code={isApiError(query.error) ? (query.error.code as ErrorCode) : "TRY_AGAIN"} />
      </PageShell>
    );
  }
  if (!activity) {
    return (
      <PageShell>
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <CardSkeleton lines={4} />
          <CardSkeleton lines={2} />
        </div>
      </PageShell>
    );
  }

  const booked = activity.viewer !== null;
  const state: "available" | "soldOut" | "booked" | "bookedHoldout" | "started" = booked
    ? activity.invitesEnabled
      ? "booked"
      : "bookedHoldout"
    : activity.status === "started"
      ? "started"
      : soldOut || activity.spotsLeft <= 0
        ? "soldOut"
        : "available";

  return (
    <PageShell>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="flex flex-col gap-5">
          <Link href="/explore" className="inline-flex items-center gap-1 text-sm font-bold text-brand">
            <ChevronLeft className="size-4" /> Explore
          </Link>
          <div className="h-[220px] overflow-hidden rounded-[20px] sm:h-[340px]">
            <Cover illustration={activity.illustration} photos={activity.photos} />
          </div>
          <div className="flex flex-col gap-3">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-body">
              <Avatar name={activity.host.displayName} size={24} /> Hosted by {activity.host.displayName}
            </span>
            <h1 className="text-3xl sm:text-4xl">{activity.title}</h1>
            <p className="text-body">{activity.description}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Fact icon={<CalendarDays className="size-4" />} label="When" value={`${formatDay(activity.startsAt, activity.timezone)}, ${formatTime(activity.startsAt, activity.timezone)}`} sub="Local time at the venue" />
            <Fact icon={<MapPin className="size-4" />} label="Where" value={activity.location} />
            <Fact icon={<Users className="size-4" />} label="Group plans" value={`${activity.plansCount} ${activity.plansCount === 1 ? "group" : "groups"} going`} />
          </div>
        </section>

        <aside>
          <Card className="flex flex-col gap-5 p-5 lg:sticky lg:top-24">
            <div className="flex items-baseline gap-2">
              <span className="font-heading text-3xl font-bold">{formatMoney(activity.price)}</span>
              <span className="text-sm text-muted-ink">per spot, paid on the day</span>
            </div>

            {state === "available" && (
              <>
                <SpotsLine spotsLeft={activity.spotsLeft} capacity={activity.capacity} live={live.connected} />
                <Cta onClick={onBook} disabled={book.isPending} aria-busy={book.isPending}>
                  {book.isPending ? (
                    <>
                      <Spinner /> Booking…
                    </>
                  ) : (
                    "Book a spot"
                  )}
                </Cta>
                <span className="text-center text-xs font-semibold text-muted-ink">{activity.invitesEnabled ? "Invite friends right after booking" : "You can invite friends as soon as you've booked"}</span>
              </>
            )}

            {state === "soldOut" && (
              <>
                <SpotsLine spotsLeft={0} capacity={activity.capacity} live={live.connected} />
                <Notice title="Someone got there a second before you" body={`The last spot went while you were booking, so you haven't been charged or booked. ${activity.host.displayName} may have another date with room.`} />
                <OtherDates hostId={activity.host.id} excludeId={activity.id} />
                <SecondaryButton
                  active={watching}
                  onClick={() => {
                    setWatching(true);
                    api.watch(activity.id, { anonId, platform: "web" }, userId).catch(() => undefined);
                  }}
                >
                  {watching ? "We'll tell you if a spot opens" : "Tell me if a spot opens"}
                </SecondaryButton>
              </>
            )}

            {state === "started" && <Notice title="This one has already started" body="Here's what's coming up instead." />}

            {(state === "booked" || state === "bookedHoldout") && (
              <>
                <Notice tone="ok" title="You're going" body={`${formatWhen(activity.startsAt, activity.timezone)}. ${others.length === 0 ? "Your group is just you so far." : activity.viewer!.planRole === "owner" ? `${listNames(others)} ${others.length === 1 ? "is" : "are"} in your group.` : `You're in ${plan.data?.plan.owner.displayName}'s group with ${listNames(others.filter((n) => n !== plan.data?.plan.owner.displayName))}.`}`} />
                <SpotsLine spotsLeft={activity.spotsLeft} capacity={activity.capacity} live={live.connected} />
                {state === "booked" ? (
                  <>
                    <span className="-mt-2 text-xs font-semibold text-muted-ink">Bring someone. Whoever claims first gets it.</span>
                    <InvitePanel activity={activity} />
                  </>
                ) : (
                  <SecondaryButton active={added} onClick={() => { downloadCalendar(activity); setAdded(true); }}>
                    {added ? "Added to calendar" : "Add to calendar"}
                  </SecondaryButton>
                )}
                <Link href="/plans" className="text-center text-sm font-bold text-brand">
                  See it in My plans
                </Link>
              </>
            )}
          </Card>
        </aside>
      </div>
      <Toast message={toast} onDone={() => setToast(null)} />
    </PageShell>
  );
}

function Fact({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)]">
      <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-ink">
        {icon} {label}
      </span>
      <span className="font-bold text-ink">{value}</span>
      {sub && <span className="text-xs text-muted-ink">{sub}</span>}
    </div>
  );
}
