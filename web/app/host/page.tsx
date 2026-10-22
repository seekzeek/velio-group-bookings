"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { Card, CardSkeleton, Chip, EmptyState, ErrorState, SecondaryButton } from "@/components/bits";
import { Cover } from "@/components/cover";
import { InvitePanel } from "@/components/invite-panel";
import { PageShell } from "@/components/page-shell";
import { PhotoUploader } from "@/components/photo-uploader";
import { SpotsLine } from "@/components/spots-line";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { api, type Member } from "@/lib/api";
import { isApiError } from "@/lib/errors";
import { categoryLabels, describeJoin, formatMoney, formatRelative, formatWhen } from "@/lib/format";
import { useLiveAvailability } from "@/lib/use-live-availability";
import { useUser } from "@/lib/user-context";
import { cn } from "@/lib/utils";

export default function HostPage() {
  return (
    <Suspense>
      <HostInner />
    </Suspense>
  );
}

function HostInner() {
  const { userId, ready } = useUser();
  const search = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [openedAt] = useState(() => Date.now());

  const mine = useQuery({ queryKey: ["activities", { hostId: "me" }, userId], queryFn: () => api.activities({ hostId: "me" }, userId), enabled: ready && !!userId });
  const selectedId = search.get("activity") ?? mine.data?.activities[0]?.id ?? null;

  useEffect(() => {
    if (!search.get("activity") && mine.data?.activities[0]) router.replace(`/host?activity=${mine.data.activities[0].id}`);
  }, [mine.data, router, search]);

  const attendance = useQuery({ queryKey: ["attendance", selectedId, userId], queryFn: () => api.attendance(userId!, selectedId!), enabled: !!selectedId && !!userId });
  const live = useLiveAvailability(selectedId);
  useEffect(() => {
    if (live.lastChange) void queryClient.invalidateQueries({ queryKey: ["attendance", selectedId] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.lastChange?.version]);

  if (ready && !userId) {
    return (
      <PageShell wide>
        <EmptyState title="Pick who you are first" body="Choose a host at the top of the page to see their activities." />
      </PageShell>
    );
  }

  if (mine.data && mine.data.activities.length === 0) {
    return (
      <PageShell wide>
        <EmptyState title="Nothing hosted yet" body="Create an activity and watch the groups form.">
          <Link href="/host/new" className="rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white">
            + New activity
          </Link>
        </EmptyState>
      </PageShell>
    );
  }

  const data = attendance.data;
  const a = data?.activity;

  return (
    <PageShell wide>
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <nav aria-label="Your activities" className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg">Your activities</h2>
            <Link href="/host/new" className="text-sm font-bold text-brand">
              + New
            </Link>
          </div>
          <div className="flex gap-2 overflow-x-auto lg:flex-col">
            {mine.data?.activities.map((act) => (
              <Link
                key={act.id}
                href={`/host?activity=${act.id}`}
                aria-current={act.id === selectedId ? "page" : undefined}
                className={cn("flex min-w-[220px] flex-col gap-1 rounded-2xl border p-3 text-sm", act.id === selectedId ? "border-brand bg-surface" : "border-line bg-surface/60")}
              >
                <span className="font-bold text-ink">{act.title}</span>
                <span className="text-body">{formatWhen(act.startsAt, act.timezone)}</span>
                <span className="text-xs font-bold text-muted-ink">
                  {act.spotsTaken} of {act.capacity} booked
                </span>
                <span className="h-1 overflow-hidden rounded-full bg-line">
                  <span className="block h-full bg-brand" style={{ width: `${Math.round((act.spotsTaken / act.capacity) * 100)}%` }} />
                </span>
              </Link>
            ))}
          </div>
        </nav>

        <section className="flex flex-col gap-6">
          {attendance.isError && <ErrorState code={isApiError(attendance.error) ? attendance.error.code : "TRY_AGAIN"} />}
          {!data && !attendance.isError && <CardSkeleton lines={4} />}
          {data && a && (
            <>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wide text-muted-ink">You&apos;re hosting</span>
                  <h1 className="text-3xl sm:text-4xl">{a.title}</h1>
                  <span className="text-sm text-body">{categoryLabels[a.category]}</span>
                </div>
                {a.invitesEnabled && (
                  <div className="flex gap-2">
                    <SecondaryButton className="w-auto px-4" onClick={() => setInviteOpen(true)}>
                      Vouch for someone
                    </SecondaryButton>
                    <button onClick={() => setInviteOpen(true)} className="h-12 rounded-2xl bg-brand px-4 text-[15px] font-bold text-white">
                      Share link
                    </button>
                  </div>
                )}
              </div>

              <Card className="grid overflow-hidden sm:grid-cols-[240px_1fr]">
                <div className="h-40 sm:h-full">
                  <Cover illustration={a.illustration} photos={a.photos} />
                </div>
                <div className="flex flex-col gap-3 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wide text-muted-ink">What guests see</span>
                    <button onClick={() => setPhotosOpen(true)} className="text-sm font-bold text-brand">
                      Photos
                    </button>
                  </div>
                  <p className="text-sm text-body">{a.description}</p>
                  <div className="flex flex-col gap-1 text-sm text-body">
                    <span>{formatWhen(a.startsAt, a.timezone)} local time</span>
                    <span>{a.location}</span>
                    <span>{formatMoney(a.price)} per spot, collected by you on the day</span>
                    <span>{a.capacity} spots in total, across every group</span>
                  </div>
                </div>
              </Card>

              <div className="grid gap-4 sm:grid-cols-3">
                <Card className="flex flex-col gap-3 p-5">
                  <SpotsLine spotsLeft={data.totals.spotsLeft} capacity={data.totals.capacity} live={live.connected} bar={false} />
                  <span className="font-heading text-4xl font-bold">
                    {data.totals.booked} of {data.totals.capacity}
                  </span>
                  <span className="h-1 overflow-hidden rounded-full bg-line">
                    <span className="block h-full bg-brand" style={{ width: `${Math.round((data.totals.booked / data.totals.capacity) * 100)}%` }} />
                  </span>
                </Card>
                <Card className="flex flex-col gap-1 p-5">
                  <span className="text-xs font-bold uppercase tracking-wide text-muted-ink">Groups</span>
                  <span className="font-heading text-4xl font-bold">{data.totals.plansCount}</span>
                  <span className="text-sm text-body">{data.totals.plansCount === 0 ? "None yet" : `${data.totals.groupsOfTwoOrMore} with two or more people`}</span>
                </Card>
                <Card className="flex flex-col gap-1 p-5">
                  <span className="text-xs font-bold uppercase tracking-wide text-muted-ink">Came through invites</span>
                  <span className="font-heading text-4xl font-bold">{data.totals.viaInvites.total}</span>
                  <span className="text-sm text-body">{data.totals.viaInvites.total === 0 ? "None yet" : `${data.totals.viaInvites.vouch} vouched, ${data.totals.viaInvites.public} from links`}</span>
                </Card>
              </div>

              {data.plans.length === 0 ? (
                <EmptyState title="No bookings yet" body="It's on Explore. Share the link or vouch for someone to get the first group started.">
                  {a.invitesEnabled && (
                    <button onClick={() => setInviteOpen(true)} className="h-12 rounded-2xl bg-brand px-4 text-[15px] font-bold text-white">
                      Share link
                    </button>
                  )}
                </EmptyState>
              ) : (
                <section className="flex flex-col gap-3">
                  <h2 className="text-xl">Who&apos;s coming, by group</h2>
                  {data.plans.map((plan) => (
                    <Card key={plan.id} className="flex flex-col gap-3 p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-bold">
                          {plan.membersCount === 1 ? `${plan.owner.displayName} · 1` : `${plan.owner.displayName}'s group · ${plan.membersCount}`}
                        </span>
                        {openedAt - new Date(plan.latestJoinAt).getTime() < 3_600_000 ? (
                          <Chip tone="ok">{plan.members.find((m) => m.joinedAt === plan.latestJoinAt)?.displayName ?? "Someone"} joined {formatRelative(plan.latestJoinAt)}</Chip>
                        ) : plan.membersCount === 1 ? (
                          <span className="text-sm text-muted-ink">Coming solo so far</span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                        {plan.members.map((m: Member) => (
                          <span key={m.userId} className="inline-flex items-center gap-2">
                            <Avatar name={m.displayName} size={24} />
                            <strong>{m.displayName}</strong>
                            <span className="text-muted-ink">· {describeJoin(m.joinedVia, m.invitedBy, userId, m.role).replace("Started the plan", "booked").replace("Booked", "booked").replace(/^Vouched by/, "vouched by").replace(/^From (.*)'s link$/, "from $1's link")}</span>
                          </span>
                        ))}
                      </div>
                    </Card>
                  ))}
                </section>
              )}

              <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                <DialogContent className="max-w-lg">
                  <DialogTitle>Fill {a.title}</DialogTitle>
                  <InvitePanel activity={a} hostMode />
                </DialogContent>
              </Dialog>
              <Dialog open={photosOpen} onOpenChange={setPhotosOpen}>
                <DialogContent className="max-w-lg">
                  <DialogTitle>Photos for {a.title}</DialogTitle>
                  <PhotoUploader activity={a} onChange={() => void queryClient.invalidateQueries({ queryKey: ["attendance", selectedId] })} />
                </DialogContent>
              </Dialog>
            </>
          )}
        </section>
      </div>
    </PageShell>
  );
}
