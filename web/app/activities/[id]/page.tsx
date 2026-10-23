"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Check } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { Button, ButtonLink, Card, CardSkeleton, ErrorState, Notice, Spinner, TextLink, Toast } from "@/components/bits";
import { Cover } from "@/components/cover";
import { InvitePanel } from "@/components/invite-panel";
import { MobileActivity } from "@/components/mobile/activity";
import { Crumb, PageShell } from "@/components/page-shell";
import { SpotsLine } from "@/components/spots-line";
import { api, type Activity } from "@/lib/api";
import { downloadCalendar } from "@/lib/calendar";
import { isApiError, type ErrorCode } from "@/lib/errors";
import { track } from "@/lib/events";
import { formatDay, formatMoney, formatTime, formatWhen, listNames } from "@/lib/format";
import { useLiveAvailability } from "@/lib/use-live-availability";
import { useUser } from "@/lib/user-context";

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
  const otherDates = useQuery({ queryKey: ["activities", { hostId: activity?.host.id, excludeId: id }], queryFn: () => api.activities({ hostId: activity!.host.id, excludeId: id }), enabled: !!activity });
  const otherDate = otherDates.data?.activities.find((a) => a.spotsLeft > 0) ?? null;

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
      <PageShell flush>
        <div className="p-5 sm:p-0">
          <ErrorState code={isApiError(query.error) ? (query.error.code as ErrorCode) : "TRY_AGAIN"} />
        </div>
      </PageShell>
    );
  }
  if (!activity) {
    return (
      <PageShell flush>
        <div className="grid gap-6 p-5 sm:p-0 lg:grid-cols-[1.4fr_1fr]">
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

  const goingBody =
    others.length === 0
      ? `${formatWhen(activity.startsAt, activity.timezone)}. Your group is just you so far.`
      : activity.viewer!.planRole === "owner"
        ? `${formatWhen(activity.startsAt, activity.timezone)}. ${listNames(others)} ${others.length === 1 ? "is" : "are"} in your group.`
        : `${formatWhen(activity.startsAt, activity.timezone)}. You're in ${plan.data?.plan.owner.displayName}'s group.`;

  const watch = () => {
    setWatching(true);
    api.watch(activity.id, { anonId, platform: "web" }, userId).catch(() => undefined);
  };
  const addToCalendar = () => {
    downloadCalendar(activity);
    setAdded(true);
  };
  const dismissToast = () => setToast(null);

  return (
    <PageShell flush>
      <div className="sm:hidden">
        <MobileActivity activity={activity} state={state} live={live.connected} toast={toast} onToastDone={dismissToast} onBook={onBook} booking={book.isPending} soldOutJustNow={soldOut} otherDate={otherDate} watching={watching} onWatch={watch} added={added} onAddCalendar={addToCalendar} />
      </div>
      <div className="hidden flex-wrap gap-6 sm:flex">
        <section className="flex min-w-0 flex-[2_1_520px] flex-col gap-5">
          <Crumb href="/explore">Explore</Crumb>
          <div className="h-[220px] overflow-hidden rounded-3xl shadow-[var(--shadow-card)] sm:h-[340px]">
            <Cover illustration={activity.illustration} photos={activity.photos} />
          </div>
          <div className="flex flex-col gap-3">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-body">
              <Avatar name={activity.host.displayName} size={24} colour="#2F6D3A" /> Hosted by {activity.host.displayName}
            </span>
            <h1 className="text-[36px] leading-none tracking-[-0.03em] sm:text-[48px]">{activity.title}</h1>
            <p className="text-base leading-relaxed text-body">{activity.description}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Fact label="When" value={`${formatDay(activity.startsAt, activity.timezone)}, ${formatTime(activity.startsAt, activity.timezone)}`} sub="Local time at the venue" />
            <Fact label="Where" value={activity.location} />
            <Fact label="Group plans" value={`${activity.plansCount} ${activity.plansCount === 1 ? "group" : "groups"} going`} />
          </div>
        </section>

        <aside className="min-w-0 flex-[1_1_340px]">
          <Card radius={24} className="flex flex-col gap-[18px] p-6 lg:sticky lg:top-[88px]">
            <div className="flex items-baseline gap-2">
              <span className="text-[32px] font-bold tracking-tight">{formatMoney(activity.price)}</span>
              <span className="text-sm text-muted-ink">per spot, paid on the day</span>
            </div>

            {state === "available" && (
              <>
                <SpotsLine spotsLeft={activity.spotsLeft} capacity={activity.capacity} live={live.connected} />
                <Button size="cta" block onClick={onBook} disabled={book.isPending} aria-busy={book.isPending}>
                  {book.isPending ? (
                    <>
                      <Spinner /> Booking…
                    </>
                  ) : (
                    "Book a spot"
                  )}
                </Button>
                <span className="text-center text-xs font-semibold text-muted-ink">{activity.invitesEnabled ? "Invite friends right after booking" : "You can invite friends as soon as you've booked"}</span>
              </>
            )}

            {state === "soldOut" && (
              <>
                <SpotsLine spotsLeft={0} capacity={activity.capacity} live={live.connected} />
                <Notice
                  title={soldOut ? "Someone got there a second before you" : "This one's full"}
                  body={`${soldOut ? "The last spot went while you were booking, so you haven't been charged or booked." : `All ${activity.capacity} spots are taken.`}${otherDate ? ` ${activity.host.displayName} has another date with room.` : ""}`}
                />
                {otherDate && (
                  <ButtonLink href={`/activities/${otherDate.id}`} size="wide" block>
                    {formatDay(otherDate.startsAt, otherDate.timezone)} · {otherDate.spotsLeft} {otherDate.spotsLeft === 1 ? "spot" : "spots"} left
                  </ButtonLink>
                )}
                <Button size="soft" variant={watching ? "tint" : "outline"} block onClick={watch}>
                  {watching ? "We'll tell you if a spot opens" : "Tell me if a spot opens"}
                </Button>
              </>
            )}

            {state === "started" && (
              <>
                <Notice title="This one has already started" body="Here's what's coming up instead." />
                <ButtonLink href="/explore" size="row" block>
                  See what&apos;s coming up
                </ButtonLink>
              </>
            )}

            {(state === "booked" || state === "bookedHoldout") && (
              <>
                <Notice tone="ok" title="You're going" body={goingBody} icon={<Check className="size-[18px]" />} />
                {state === "booked" ? (
                  <>
                    <SpotsLine spotsLeft={activity.spotsLeft} capacity={activity.capacity} live={live.connected} note="Bring someone. Whoever claims first gets it." />
                    <InvitePanel activity={activity} />
                  </>
                ) : (
                  <Button size="soft" variant={added ? "tint" : "outline"} block onClick={addToCalendar}>
                    <CalendarCheck className="size-4" /> {added ? "Added to calendar" : "Add to calendar"}
                  </Button>
                )}
                <TextLink href="/plans" className="min-h-10 justify-center">
                  See it in My plans
                </TextLink>
              </>
            )}
          </Card>
        </aside>
      </div>
      <div className="hidden sm:block">
        <Toast message={toast} onDone={dismissToast} />
      </div>
    </PageShell>
  );
}

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex min-w-0 flex-[1_1_180px] flex-col gap-1 rounded-[14px] bg-surface px-4 py-3.5 shadow-[var(--shadow-card)]">
      <span className="text-xs font-bold uppercase tracking-[0.06em] text-muted-ink">{label}</span>
      <span className="font-bold text-ink">{value}</span>
      {sub && <span className="text-xs text-muted-ink">{sub}</span>}
    </div>
  );
}
