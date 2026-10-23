"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Avatar } from "@/components/avatar";
import { Button, ButtonLink, Card, CardSkeleton, Chip, Dot, EmptyState, ErrorState, TextLink } from "@/components/bits";
import { Cover } from "@/components/cover";
import { PageShell } from "@/components/page-shell";
import { SpotsLine } from "@/components/spots-line";
import { api, type Activity, type MyPlans } from "@/lib/api";
import { isApiError } from "@/lib/errors";
import { track } from "@/lib/events";
import { describeJoin, formatWhen } from "@/lib/format";
import { useUser } from "@/lib/user-context";
import { cn } from "@/lib/utils";

export default function PlansPage() {
  return (
    <Suspense>
      <PlansInner />
    </Suspense>
  );
}

/** My plans from the canvas: Going and Hosting tabs with a 3px underline. */
function PlansInner() {
  const { userId, ready } = useUser();
  const search = useSearchParams();
  const [tab, setTab] = useState<"going" | "hosting">(search.get("tab") === "hosting" ? "hosting" : "going");
  const [showPast, setShowPast] = useState(false);
  const plans = useQuery({ queryKey: ["my-plans", userId, showPast], queryFn: () => api.myPlans(userId!, showPast), enabled: ready && !!userId });

  if (ready && !userId) {
    return (
      <PageShell>
        <EmptyState title="Pick who you are first" body="Choose a user at the top of the page to see their plans." icon={<CalendarDays className="size-7" />}>
          <TextLink href="/i">Got an invite code?</TextLink>
        </EmptyState>
      </PageShell>
    );
  }

  const data = plans.data;
  const going = data?.going ?? [];
  const hosting = data?.hosting ?? [];
  const spotsBooked = hosting.reduce((n, h) => n + h.activity.spotsTaken, 0);
  const spotsTotal = hosting.reduce((n, h) => n + h.activity.capacity, 0);
  const groups = hosting.reduce((n, h) => n + h.attendance.plansCount, 0);

  return (
    <PageShell>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[32px] leading-[1.02] tracking-[-0.03em] sm:text-[40px]">My plans</h1>
        <span className="text-base text-body">Everything you&apos;re going to, and everything you&apos;re running.</span>
      </div>
      <div role="tablist" aria-label="Plans" className="mt-5 flex border-b border-line">
        {(["going", "hosting"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn("-mb-px h-[46px] border-b-[3px] px-[18px] text-[15px] font-bold", tab === t ? "border-brand text-ink" : "border-transparent text-muted-ink")}>
            {t === "going" ? `Going · ${going.length}` : `Hosting · ${hosting.length}`}
          </button>
        ))}
      </div>

      {plans.isPending && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <CardSkeleton lines={3} />
          <CardSkeleton lines={3} />
        </div>
      )}
      {plans.isError && (
        <div className="mt-6">
          <ErrorState code={isApiError(plans.error) ? plans.error.code : "TRY_AGAIN"} />
        </div>
      )}

      {data && tab === "going" && (
        <div className="mt-6 flex flex-col gap-4">
          {going.length === 0 ? (
            <EmptyState title="Nothing booked yet" body="Book one spot on something this week. Then bring your people." icon={<CalendarDays className="size-7" />}>
              <ButtonLink href="/explore" size="row" className="h-[46px]">
                Find something on Explore
              </ButtonLink>
              <TextLink href="/i">Got an invite code?</TextLink>
            </EmptyState>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {going.map((g) => (
                <GoingCard key={g.plan.id} entry={g} userId={userId!} />
              ))}
            </div>
          )}
          <button type="button" onClick={() => setShowPast((p) => !p)} className="self-start text-sm font-bold text-brand">
            {showPast ? "Hide past plans" : "Past plans"}
          </button>
          {showPast && data.past.length > 0 && (
            <div className="grid gap-4 opacity-80 md:grid-cols-2">
              {data.past.map((g) => (
                <GoingCard key={g.plan.id} entry={g} userId={userId!} past />
              ))}
            </div>
          )}
          {showPast && data.past.length === 0 && <span className="text-sm text-muted-ink">Nothing in the past yet.</span>}
        </div>
      )}

      {data && tab === "hosting" && (
        <div className="mt-6 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-body">
              <strong className="text-ink">
                {spotsBooked} of {spotsTotal}
              </strong>{" "}
              spots booked across {hosting.length} {hosting.length === 1 ? "activity" : "activities"} · <strong className="text-ink">{groups}</strong> groups
            </span>
            <Link href="/host/new" className="inline-flex h-[42px] items-center rounded-xl border-[1.5px] border-dashed border-brand px-4 text-sm font-bold text-brand">
              + New activity
            </Link>
          </div>
          {hosting.length === 0 ? (
            <EmptyState title="Nothing hosted yet" body="Create an activity and watch the groups form." icon={<CalendarDays className="size-7" />}>
              <ButtonLink href="/host/new" size="row" className="h-[46px]">
                + New activity
              </ButtonLink>
            </EmptyState>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {hosting.map((h) => (
                <HostingCard key={h.activity.id} activity={h.activity} plansCount={h.attendance.plansCount} viaInvites={h.attendance.viaInvites.total} />
              ))}
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}

function GoingCard({ entry, userId, past = false }: { entry: MyPlans["going"][number]; userId: string; past?: boolean }) {
  const { plan, activity, viewerRole, viewerJoinedVia, pendingVouches } = entry;
  const owner = viewerRole === "owner";
  return (
    <Card className="flex flex-col gap-3.5 p-5">
      <div className="flex items-center justify-between gap-3">
        <Chip tone={owner ? "ok" : "grey"}>{owner ? "Your group · you booked" : `In ${plan.owner.displayName}'s group`}</Chip>
        <span className="text-[13px] text-body">{formatWhen(activity.startsAt, activity.timezone)}</span>
      </div>
      <Link href={`/activities/${activity.id}`} className="text-xl font-bold">
        {activity.title}
      </Link>
      <div className="flex flex-col divide-y divide-[#EEF0F2]">
        {plan.members.map((m) => (
          <div key={m.userId} className="flex items-center justify-between py-2 text-sm">
            <span className="inline-flex items-center gap-2">
              <Avatar name={m.displayName} size={26} colour={m.userId === userId ? "#2F6D3A" : undefined} /> {m.userId === userId ? "You" : m.displayName}
            </span>
            <span className="text-[13px] text-muted-ink">{m.userId === userId && owner ? "Booked" : describeJoin(m.joinedVia, m.invitedBy, userId, m.role)}</span>
          </div>
        ))}
        {pendingVouches > 0 && (
          <div className="flex items-center justify-between py-2 text-sm">
            <span className="inline-flex items-center gap-2">
              <span className="inline-block size-[26px] rounded-full border-2 border-dashed border-[#C9CDD3]" />
              {pendingVouches === 1 ? "One more vouch" : `${pendingVouches} more vouches`}
            </span>
            <span className="text-[13px] text-muted-ink">Not claimed yet</span>
          </div>
        )}
      </div>
      {!past && (
        <div className="flex items-center justify-between gap-3 border-t border-[#EEF0F2] pt-3">
          <span className="inline-flex items-center gap-2 text-sm text-body">
            <Dot spotsLeft={activity.spotsLeft} />
            {activity.spotsLeft} spots left{owner ? " · invites don't hold one" : " on this activity"}
            {viewerJoinedVia === "public" && !owner ? ` · you joined from ${plan.owner.displayName}'s link` : ""}
          </span>
          {activity.invitesEnabled && activity.spotsLeft > 0 && owner && (
            <TextLink href={`/activities/${activity.id}#invite`} className="whitespace-nowrap">
              Invite more
            </TextLink>
          )}
        </div>
      )}
    </Card>
  );
}

function HostingCard({ activity, plansCount, viaInvites }: { activity: Activity; plansCount: number; viaInvites: number }) {
  const { userId, anonId } = useUser();
  const [copied, setCopied] = useState(false);
  const share = useMutation({
    mutationFn: () => api.createInvite(userId!, { rail: "public", activityId: activity.id, platform: "web" }),
    onSuccess: async ({ invite }) => {
      try {
        await navigator.clipboard.writeText(invite.url);
      } catch {
        window.prompt("Copy this link", invite.url);
      }
      setCopied(true);
      track({ name: "invite_link_copied", anonId, userId, activityId: activity.id, inviteCode: invite.code });
    },
  });
  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="h-[150px]">
        <Cover illustration={activity.illustration} photos={activity.photos} />
      </div>
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <Chip tone="ink">You&apos;re hosting</Chip>
          <span className="text-[13px] text-body">{formatWhen(activity.startsAt, activity.timezone)}</span>
        </div>
        <span className="text-lg font-bold">{activity.title}</span>
        <SpotsLine spotsLeft={activity.spotsLeft} capacity={activity.capacity} size="card" />
        <div className="flex justify-between text-[13px] text-body">
          <span>
            <strong className="text-ink">{plansCount}</strong> {plansCount === 1 ? "group" : "groups"}
          </span>
          <span>
            <strong className="text-ink">{viaInvites}</strong> came through invites
          </span>
        </div>
        <div className="flex gap-2">
          <ButtonLink href={`/host?activity=${activity.id}`} size="card" className="h-[42px] flex-1 text-sm">
            Live attendance
          </ButtonLink>
          {activity.invitesEnabled && (
            <Button size="card" variant={copied ? "tint" : "outline"} className="h-[42px] flex-1 text-sm" onClick={() => share.mutate()} disabled={share.isPending}>
              {copied ? "Link copied" : "Share link"}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
