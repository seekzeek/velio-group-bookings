"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Avatar, AvatarStack } from "@/components/avatar";
import { Card, CardSkeleton, EmptyState, ErrorState } from "@/components/bits";
import { Cover } from "@/components/cover";
import { PageShell } from "@/components/page-shell";
import { SpotsLine } from "@/components/spots-line";
import { api, type MyPlans } from "@/lib/api";
import { isApiError } from "@/lib/errors";
import { describeJoin, formatWhen, listNames } from "@/lib/format";
import { useUser } from "@/lib/user-context";
import { cn } from "@/lib/utils";

export default function PlansPage() {
  return (
    <Suspense>
      <PlansInner />
    </Suspense>
  );
}

function PlansInner() {
  const { userId, ready } = useUser();
  const search = useSearchParams();
  const [tab, setTab] = useState<"going" | "hosting">(search.get("tab") === "hosting" ? "hosting" : "going");
  const [showPast, setShowPast] = useState(false);
  const plans = useQuery({ queryKey: ["my-plans", userId, showPast], queryFn: () => api.myPlans(userId!, showPast), enabled: ready && !!userId });

  if (ready && !userId) {
    return (
      <PageShell>
        <EmptyState title="Pick who you are first" body="Choose a user at the top of the page to see their plans.">
          <Link href="/i" className="text-sm font-bold text-brand">
            Got an invite code?
          </Link>
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
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl sm:text-4xl">My plans</h1>
        <span className="text-body">Everything you&apos;re going to, and everything you&apos;re running.</span>
      </div>
      <div role="tablist" aria-label="Plans" className="mt-5 flex gap-1 border-b border-line">
        {(["going", "hosting"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn("-mb-px border-b-2 px-3 py-2.5 text-sm font-bold", tab === t ? "border-brand text-ink" : "border-transparent text-muted-ink")}>
            {t === "going" ? `Going · ${going.length}` : `Hosting · ${hosting.length}`}
          </button>
        ))}
      </div>

      {plans.isPending && (
        <div className="mt-6 grid gap-5 md:grid-cols-2">
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
        <div className="mt-6 flex flex-col gap-5">
          {going.length === 0 ? (
            <EmptyState title="Nothing booked yet" body="Book one spot on something this week. Then bring your people.">
              <div className="flex gap-3">
                <Link href="/explore" className="rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white">
                  Find something on Explore
                </Link>
                <Link href="/i" className="px-2 py-2.5 text-sm font-bold text-brand">
                  Got an invite code?
                </Link>
              </div>
            </EmptyState>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {going.map((g) => (
                <GoingCard key={g.plan.id} entry={g} userId={userId!} />
              ))}
            </div>
          )}
          <button onClick={() => setShowPast((p) => !p)} className="self-start text-sm font-bold text-brand">
            {showPast ? "Hide past plans" : "Past plans"}
          </button>
          {showPast && data.past.length > 0 && (
            <div className="grid gap-5 opacity-80 md:grid-cols-2">
              {data.past.map((g) => (
                <GoingCard key={g.plan.id} entry={g} userId={userId!} past />
              ))}
            </div>
          )}
          {showPast && data.past.length === 0 && <span className="text-sm text-muted-ink">Nothing in the past yet.</span>}
        </div>
      )}

      {data && tab === "hosting" && (
        <div className="mt-6 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-body">
              <strong>
                {spotsBooked} of {spotsTotal}
              </strong>{" "}
              spots booked across {hosting.length} {hosting.length === 1 ? "activity" : "activities"} · <strong>{groups}</strong> groups
            </span>
            <Link href="/host/new" className="text-sm font-bold text-brand">
              + New activity
            </Link>
          </div>
          {hosting.length === 0 ? (
            <EmptyState title="Nothing hosted yet" body="Create an activity and watch the groups form.">
              <Link href="/host/new" className="rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white">
                + New activity
              </Link>
            </EmptyState>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {hosting.map((h) => (
                <Card key={h.activity.id} className="overflow-hidden">
                  <div className="h-[150px]">
                    <Cover illustration={h.activity.illustration} photos={h.activity.photos} />
                  </div>
                  <div className="flex flex-col gap-3 p-5">
                    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted-ink">
                      <span>You&apos;re hosting</span>
                      <span className="normal-case tracking-normal text-body">{formatWhen(h.activity.startsAt, h.activity.timezone)}</span>
                    </div>
                    <span className="text-lg font-bold">{h.activity.title}</span>
                    <SpotsLine spotsLeft={h.activity.spotsLeft} capacity={h.activity.capacity} />
                    <div className="flex justify-between text-sm text-body">
                      <span>
                        <strong>{h.attendance.plansCount}</strong> {h.attendance.plansCount === 1 ? "group" : "groups"}
                      </span>
                      <span>
                        <strong>{h.attendance.viaInvites.total}</strong> came through invites
                      </span>
                    </div>
                    <Link href={`/host?activity=${h.activity.id}`} className="flex h-11 items-center justify-center rounded-2xl bg-brand text-sm font-bold text-white">
                      Live attendance
                    </Link>
                  </div>
                </Card>
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
  const others = plan.members.filter((m) => m.userId !== userId).map((m) => m.displayName);
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted-ink">
        <span>{viewerRole === "owner" ? "Your group · you booked" : `In ${plan.owner.displayName}'s group`}</span>
        <span className="normal-case tracking-normal text-body">{formatWhen(activity.startsAt, activity.timezone)}</span>
      </div>
      <Link href={`/activities/${activity.id}`} className="text-xl font-bold">
        {activity.title}
      </Link>
      <div className="flex flex-col divide-y divide-line">
        {plan.members.map((m) => (
          <div key={m.userId} className="flex items-center justify-between py-2 text-sm">
            <span className="inline-flex items-center gap-2">
              <Avatar name={m.displayName} size={24} /> {m.userId === userId ? "You" : m.displayName}
            </span>
            <span className="text-muted-ink">{m.userId === userId && viewerRole === "owner" ? "Booked" : describeJoin(m.joinedVia, m.invitedBy, userId, m.role)}</span>
          </div>
        ))}
        {pendingVouches > 0 && (
          <div className="flex items-center justify-between py-2 text-sm">
            <span className="inline-flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full border border-dashed border-[#C9CDD3] text-xs text-muted-ink">?</span>
              {pendingVouches === 1 ? "One more vouch" : `${pendingVouches} more vouches`}
            </span>
            <span className="text-muted-ink">Not claimed yet</span>
          </div>
        )}
      </div>
      {others.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-body">
          <AvatarStack names={[...(viewerRole === "owner" ? ["You"] : []), ...others]} size={24} />
          {viewerRole === "owner" ? `You and ${listNames(others)}` : `${listNames(others)} and you`}
        </div>
      )}
      {!past && (
        <div className="flex items-center justify-between border-t border-line pt-3 text-sm">
          <span className="text-body">
            {activity.spotsLeft} spots left{viewerRole === "owner" ? " · invites don't hold one" : " on this activity"}
            {viewerJoinedVia === "public" && viewerRole === "member" ? ` · you joined from ${plan.owner.displayName}'s link` : ""}
          </span>
          {activity.invitesEnabled && activity.spotsLeft > 0 && (
            <Link href={`/activities/${activity.id}#invite`} className="font-bold text-brand">
              Invite more
            </Link>
          )}
        </div>
      )}
    </Card>
  );
}
