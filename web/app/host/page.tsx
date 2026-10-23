"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { Button, Card, CardSkeleton, Chip, Dot, EmptyState, ErrorState, Eyebrow, TextLink, inputClass } from "@/components/bits";
import { Cover } from "@/components/cover";
import { MobileAttendance } from "@/components/mobile/attendance";
import { PageShell } from "@/components/page-shell";
import { PhotoUploader } from "@/components/photo-uploader";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { api, type Activity, type Member } from "@/lib/api";
import { isApiError } from "@/lib/errors";
import { track } from "@/lib/events";
import { categoryLabels, formatMoney, formatRelative, formatWhen } from "@/lib/format";
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

function arrival(m: Member, viewerId: string | null) {
  if (m.joinedVia === "direct") return "booked";
  const by = m.invitedBy ? (m.invitedBy.id === viewerId ? "you" : m.invitedBy.displayName) : "someone";
  return m.joinedVia === "vouch" ? `vouched by ${by}` : `from ${by === "you" ? "your" : `${by}'s`} link`;
}

/** Live attendance: the host's activities down the side, the chosen one's details, three tiles, and who's coming by group. */
function HostInner() {
  const { userId, anonId, ready } = useUser();
  const search = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [openedAt] = useState(() => Date.now());
  const [vouchOpen, setVouchOpen] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const share = useMutation({
    mutationFn: (activity: Activity) => api.createInvite(userId!, { rail: "public", activityId: activity.id, platform: "web" }),
    onSuccess: async ({ invite }, activity) => {
      try {
        await navigator.clipboard.writeText(invite.url);
      } catch {
        window.prompt("Copy this link", invite.url);
      }
      setCopied(true);
      track({ name: "invite_link_copied", anonId, userId, activityId: activity.id, inviteCode: invite.code });
      setTimeout(() => setCopied(false), 2500);
    },
  });

  if (ready && !userId) {
    return (
      <PageShell flush>
        <div className="p-5 sm:p-0">
          <EmptyState title="Pick who you are first" body="Choose a host at the top of the page to see their activities." />
        </div>
      </PageShell>
    );
  }

  if (mine.data && mine.data.activities.length === 0) {
    return (
      <PageShell flush>
        <div className="p-5 sm:p-0">
          <EmptyState title="Nothing hosted yet" body="Create an activity and watch the groups form." icon={<Inbox className="size-7" />}>
            <Link href="/host/new" className="inline-flex h-[46px] items-center rounded-xl bg-brand px-5 text-[15px] font-bold text-white">
              + New activity
            </Link>
          </EmptyState>
        </div>
      </PageShell>
    );
  }

  const data = attendance.data;
  const a = data?.activity;
  const actions = a && a.invitesEnabled && (
    <div className="flex flex-wrap gap-2">
      <Button size="card" variant="outline" className="text-sm" onClick={() => setVouchOpen(true)}>
        Vouch for someone
      </Button>
      <Button size="card" variant={copied ? "tint" : "primary"} className="text-sm" onClick={() => share.mutate(a)} disabled={share.isPending}>
        {copied ? "Link copied" : "Share link"}
      </Button>
    </div>
  );

  return (
    <PageShell flush>
      <div className="sm:hidden">
        {attendance.isError && (
          <div className="p-5">
            <ErrorState code={isApiError(attendance.error) ? attendance.error.code : "TRY_AGAIN"} />
          </div>
        )}
        {!data && !attendance.isError && (
          <div className="p-5">
            <CardSkeleton lines={4} />
          </div>
        )}
        {data && a && <MobileAttendance data={data} live={live.connected} userId={userId} openedAt={openedAt} onVouch={() => setVouchOpen(true)} onShare={() => share.mutate(a)} sharing={share.isPending} copied={copied} onEditPhotos={() => setPhotosOpen(true)} />}
      </div>
      <div className="hidden flex-wrap gap-6 sm:flex">
        <nav aria-label="Your activities" className="flex min-w-0 flex-[1_1_260px] flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <Eyebrow>Your activities</Eyebrow>
            <TextLink href="/host/new">+ New</TextLink>
          </div>
          {mine.data?.activities.map((act) => {
            const current = act.id === selectedId;
            return (
              <Link
                key={act.id}
                href={`/host?activity=${act.id}`}
                aria-current={current ? "page" : undefined}
                className={cn("flex flex-col gap-2.5 rounded-2xl bg-surface p-4 text-ink", current ? "shadow-[0_0_0_1.5px_var(--brand),0_8px_24px_rgba(21,23,26,0.06)]" : "shadow-[var(--shadow-card)]")}
              >
                <span className="text-[15px] font-bold">{act.title}</span>
                <span className="text-[13px] text-body">{formatWhen(act.startsAt, act.timezone)}</span>
                <span className="inline-flex items-center gap-2 text-[13px] font-bold text-brand-deep">
                  <Dot spotsLeft={act.spotsLeft} /> {act.spotsTaken} of {act.capacity} booked
                </span>
                <span className="h-1 overflow-hidden rounded-sm bg-line">
                  <span className="block h-full bg-brand" style={{ width: `${Math.round((act.spotsTaken / act.capacity) * 100)}%` }} />
                </span>
              </Link>
            );
          })}
        </nav>

        <section className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
          {attendance.isError && <ErrorState code={isApiError(attendance.error) ? attendance.error.code : "TRY_AGAIN"} />}
          {!data && !attendance.isError && <CardSkeleton lines={4} />}
          {data && a && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <Chip tone="ink" className="w-fit">
                    You&apos;re hosting
                  </Chip>
                  <h1 className="text-[32px] leading-[1.02] tracking-[-0.03em] sm:text-[40px]">{a.title}</h1>
                  <span className="text-sm text-body">{categoryLabels[a.category]}</span>
                </div>
                {actions}
              </div>

              <Card className="flex flex-wrap overflow-hidden">
                <div className="h-40 min-w-0 flex-[1_1_240px] sm:h-auto">
                  <Cover illustration={a.illustration} photos={a.photos} />
                </div>
                <div className="flex min-w-0 flex-[2_1_320px] flex-col gap-3 p-5">
                  <div className="flex items-center justify-between">
                    <Eyebrow>What guests see</Eyebrow>
                    <button type="button" onClick={() => setPhotosOpen(true)} className="inline-flex min-h-9 items-center text-sm font-bold text-brand">
                      Edit photos
                    </button>
                  </div>
                  <p className="text-sm leading-relaxed text-body">{a.description}</p>
                  <div className="flex flex-col gap-1 text-sm text-body">
                    <span>{formatWhen(a.startsAt, a.timezone)} local time</span>
                    <span>{a.location}</span>
                    <span>{formatMoney(a.price)} per spot, collected by you on the day</span>
                    <span>{a.capacity} spots in total, across every group</span>
                  </div>
                </div>
              </Card>

              <div className="grid gap-3 sm:grid-cols-3">
                <Card radius={16} className="flex flex-col gap-2.5 px-5 py-[18px]">
                  <div className="flex items-center justify-between">
                    <Eyebrow>Booked</Eyebrow>
                    <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-ink">{live.connected ? "Live" : "Not live"}</span>
                  </div>
                  <span className="inline-flex items-center gap-2.5 text-[28px] font-bold tracking-tight">
                    <Dot spotsLeft={data.totals.spotsLeft} /> {data.totals.booked} of {data.totals.capacity}
                  </span>
                  <span className="h-1 overflow-hidden rounded-sm bg-line">
                    <span className="block h-full" style={{ width: `${Math.round((data.totals.booked / data.totals.capacity) * 100)}%`, background: data.totals.spotsLeft <= 3 ? "var(--scarcity-dot)" : "var(--brand)" }} />
                  </span>
                </Card>
                <Card radius={16} className="flex flex-col gap-1 px-5 py-[18px]">
                  <Eyebrow>Groups</Eyebrow>
                  <span className="text-[28px] font-bold tracking-tight">{data.totals.plansCount}</span>
                  <span className="text-[13px] text-body">{data.totals.plansCount === 0 ? "None yet" : `${data.totals.groupsOfTwoOrMore} with two or more people`}</span>
                </Card>
                <Card radius={16} className="flex flex-col gap-1 px-5 py-[18px]">
                  <Eyebrow>Came through invites</Eyebrow>
                  <span className="text-[28px] font-bold tracking-tight">{data.totals.viaInvites.total}</span>
                  <span className="text-[13px] text-body">{data.totals.viaInvites.total === 0 ? "None yet" : `${data.totals.viaInvites.vouch} vouched, ${data.totals.viaInvites.public} from links`}</span>
                </Card>
              </div>

              {data.plans.length === 0 ? (
                <EmptyState title="No bookings yet" body="It's on Explore. Share the link or vouch for someone to get the first group started." icon={<Inbox className="size-7" />}>
                  {actions}
                </EmptyState>
              ) : (
                <section className="flex flex-col gap-3">
                  <Eyebrow>Who&apos;s coming, by group</Eyebrow>
                  {data.plans.map((plan) =>
                    plan.membersCount === 1 ? (
                      <Card key={plan.id} radius={18} className="flex items-center gap-3 px-5 py-4">
                        <Avatar name={plan.owner.displayName} size={30} />
                        <span className="text-[15px] font-bold">{plan.owner.displayName} · 1</span>
                        <span className="text-[13px] text-muted-ink">Coming solo so far</span>
                      </Card>
                    ) : (
                      <Card key={plan.id} radius={18} className="flex flex-col gap-3 px-5 py-[18px]">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-base font-bold">
                            {plan.owner.displayName}&apos;s group · {plan.membersCount}
                          </span>
                          {openedAt - new Date(plan.latestJoinAt).getTime() < 3_600_000 && (
                            <Chip tone="ok">
                              {plan.members.find((m) => m.joinedAt === plan.latestJoinAt)?.displayName ?? "Someone"} joined {formatRelative(plan.latestJoinAt)}
                            </Chip>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {plan.members.map((m) => (
                            <span key={m.userId} className="inline-flex items-center gap-2 rounded-full bg-ground py-1 pl-1 pr-3 text-[13px]">
                              <Avatar name={m.displayName} size={26} />
                              <strong>{m.displayName}</strong>
                              <span className="text-muted-ink">· {arrival(m, userId)}</span>
                            </span>
                          ))}
                        </div>
                      </Card>
                    ),
                  )}
                </section>
              )}

            </>
          )}
        </section>
      </div>
      {a && (
        <>
          <Dialog open={vouchOpen} onOpenChange={setVouchOpen}>
            <DialogContent className="max-w-md">
              <DialogTitle>Vouch for someone</DialogTitle>
              <HostVouch activity={a} onDone={() => setVouchOpen(false)} />
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
    </PageShell>
  );
}

function HostVouch({ activity, onDone }: { activity: Activity; onDone: () => void }) {
  const { userId } = useUser();
  const [label, setLabel] = useState("");
  const [contact, setContact] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ url: string; codeDisplay: string } | null>(null);
  const vouch = useMutation({
    mutationFn: () => api.createInvite(userId!, { rail: "vouch", activityId: activity.id, recipientContact: contact, recipientLabel: label || undefined, platform: "web" }),
    onSuccess: ({ invite }) => setSent({ url: invite.url, codeDisplay: invite.codeDisplay }),
    onError: (err) => setError(isApiError(err, "VALIDATION") ? "Enter a phone number or email." : isApiError(err) ? err.message : "Something went wrong. Try again."),
  });
  if (sent) {
    return (
      <div className="flex flex-col gap-3">
        <span className="text-sm text-body">Only that number or email can claim it. Send them the link however you like. They start their own group.</span>
        <input readOnly value={sent.url} className={`${inputClass} bg-[#F7F8F7]`} aria-label="Vouch link" />
        <Button size="row" onClick={onDone}>
          Done
        </Button>
      </div>
    );
  }
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        vouch.mutate();
      }}
    >
      <span className="text-sm text-body">A personal invite with your name on it. They start their own group.</span>
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Who's it for? Only you see this" maxLength={40} className={inputClass} aria-label="Who it's for" />
      <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Phone number or email" className={inputClass} aria-label="Their phone number or email" aria-invalid={!!error} />
      {error && (
        <span role="alert" className="text-[13px] font-semibold text-scarcity-text">
          {error}
        </span>
      )}
      <Button type="submit" size="row" disabled={vouch.isPending || !contact}>
        Send vouch
      </Button>
    </form>
  );
}
