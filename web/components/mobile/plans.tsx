"use client";

import { useMutation } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Chip, Skeleton, TextButton, TextLink, ErrorState } from "@/components/bits";
import { api, type Activity, type MyPlans } from "@/lib/api";
import type { ErrorCode } from "@/lib/errors";
import { track } from "@/lib/events";
import { formatWhen, listNames } from "@/lib/format";
import { useUser } from "@/lib/user-context";
import { Bar, BottomBar, DotLine, EmptyBlock, H1, LiveTag, Screen, SegmentedTabs, Stack } from "./bits";

type Props = {
  data: MyPlans | undefined;
  pending: boolean;
  error: ErrorCode | null;
  onRetry: () => void;
  tab: "going" | "hosting";
  setTab: (t: "going" | "hosting") => void;
  showPast: boolean;
  setShowPast: (v: boolean) => void;
  userId: string;
};

/** My plans on a phone: title with "Got a code?", the two-way switch, then cards; hosting pins "+ New activity" to the bottom. */
export function MobilePlans({ data, pending, error, onRetry, tab, setTab, showPast, setShowPast, userId }: Props) {
  const going = data?.going ?? [];
  const hosting = data?.hosting ?? [];
  const rows = showPast ? (data?.past ?? []) : going;
  return (
    <Screen>
      <div className="flex h-11 items-center justify-between px-5 pt-5">
        <H1>My plans</H1>
        <TextLink href="/i">Got a code?</TextLink>
      </div>
      <div className="px-5 pt-4">
        <SegmentedTabs label="Plans" labels={[`Going · ${going.length}`, `Hosting · ${hosting.length}`]} index={tab === "going" ? 0 : 1} onChange={(i) => setTab(i === 0 ? "going" : "hosting")} />
      </div>

      {pending && (
        <div className="flex flex-col gap-3 p-5">
          <Skeleton className="h-44 rounded-[20px]" />
          <Skeleton className="h-44 rounded-[20px]" />
        </div>
      )}
      {error && (
        <div className="p-5">
          <ErrorState code={error} action={<TextButton onClick={onRetry}>Try again</TextButton>} />
        </div>
      )}

      {data && tab === "going" && (
        <>
          {rows.length === 0 && !showPast ? (
            <EmptyBlock icon={<CalendarDays className="size-7" />} title="Nothing booked yet" body="Book one spot on something this week. Then bring your people.">
              <Link href="/explore" className="inline-flex h-12 items-center rounded-[14px] bg-brand px-5 text-[15px] font-bold text-white">
                Find something on Explore
              </Link>
              <TextLink href="/i" muted className="min-h-11 text-ink">
                Got an invite code?
              </TextLink>
              {data.past.length > 0 && (
                <TextButton onClick={() => setShowPast(true)} className="min-h-11 font-semibold text-ink">
                  Past plans
                </TextButton>
              )}
            </EmptyBlock>
          ) : (
            <div className="flex flex-col gap-3 p-5">
              {rows.map((g) => (
                <GoingCard key={g.plan.id} entry={g} userId={userId} past={showPast} />
              ))}
              {rows.length === 0 && <span className="text-sm text-muted-ink">Nothing in the past yet.</span>}
              <TextButton onClick={() => setShowPast(!showPast)} className="min-h-11 self-center font-semibold text-ink">
                {showPast ? "Back to upcoming" : "Past plans"}
              </TextButton>
            </div>
          )}
        </>
      )}

      {data && tab === "hosting" && (
        <>
          {hosting.length === 0 ? (
            <EmptyBlock icon={<CalendarDays className="size-7" />} title="Nothing hosted yet" body="Create an activity and watch the groups form." />
          ) : (
            <div className="flex flex-col gap-3 p-5">
              {hosting.map((h) => (
                <HostingCard key={h.activity.id} activity={h.activity} plansCount={h.attendance.plansCount} />
              ))}
            </div>
          )}
          <BottomBar className="pb-3">
            <Link href="/host/new" className="flex h-[52px] flex-1 items-center justify-center rounded-2xl bg-brand text-base font-bold text-white shadow-[var(--shadow-cta)]">
              + New activity
            </Link>
          </BottomBar>
        </>
      )}
    </Screen>
  );
}

function GoingCard({ entry, userId, past }: { entry: MyPlans["going"][number]; userId: string; past: boolean }) {
  const { plan, activity: a, viewerRole, viewerJoinedVia, pendingVouches } = entry;
  const owner = viewerRole === "owner";
  const others = plan.members.filter((m) => m.userId !== userId).map((m) => m.displayName);
  const who = owner ? (others.length === 0 ? "Just you so far" : `You and ${listNames(others)}`) : listNames([...others, "you"]);
  const stack = owner ? ["You", ...others] : [...others, "You"];
  return (
    <Link href={`/activities/${a.id}`} className="flex flex-col gap-3 rounded-[20px] bg-surface p-4 text-ink shadow-[var(--shadow-card)]">
      <span className="flex items-center justify-between gap-2">
        <Chip tone={owner ? "ok" : "grey"}>{owner ? "Your group" : `In ${plan.owner.displayName}'s group`}</Chip>
        <span className="text-[13px] font-semibold text-muted-ink">{formatWhen(a.startsAt, a.timezone)}</span>
      </span>
      <span className="font-heading text-xl font-bold tracking-[-0.01em]">{a.title}</span>
      <span className="flex items-center gap-2.5">
        <Stack names={[...stack, ...(pendingVouches > 0 ? ["?"] : [])]} />
        <span className="text-sm text-body">
          {who}
          {pendingVouches > 0 ? ` · ${pendingVouches} ${pendingVouches === 1 ? "vouch" : "vouches"} not claimed yet` : ""}
        </span>
      </span>
      {!past && (
        <span className="flex items-center justify-between gap-2.5 border-t border-[#EEF0F2] pt-3">
          <DotLine spotsLeft={a.spotsLeft} text={`${a.spotsLeft} spots left`} className="min-w-0 flex-wrap">
            {viewerJoinedVia === "public" && !owner && <span className="font-medium text-muted-ink"> · you joined from {plan.owner.displayName}&apos;s link</span>}
          </DotLine>
          {owner && a.invitesEnabled && a.spotsLeft > 0 && <span className="inline-flex min-h-9 items-center text-sm font-bold text-brand">Invite more</span>}
        </span>
      )}
    </Link>
  );
}

function HostingCard({ activity: a, plansCount }: { activity: Activity; plansCount: number }) {
  const { userId, anonId } = useUser();
  const [copied, setCopied] = useState(false);
  const share = useMutation({
    mutationFn: () => api.createInvite(userId!, { rail: "public", activityId: a.id, platform: "web" }),
    onSuccess: async ({ invite }) => {
      try {
        await navigator.clipboard.writeText(invite.url);
      } catch {
        window.prompt("Copy this link", invite.url);
      }
      setCopied(true);
      track({ name: "invite_link_copied", anonId, userId, activityId: a.id, inviteCode: invite.code });
    },
  });
  return (
    <article className="flex flex-col gap-2.5 rounded-[20px] bg-surface p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-2">
        <Chip tone="ink">You&apos;re hosting</Chip>
        <span className="text-[13px] font-semibold text-muted-ink">{formatWhen(a.startsAt, a.timezone)}</span>
      </div>
      <span className="font-heading text-xl font-bold tracking-[-0.01em]">{a.title}</span>
      <div className="flex items-center justify-between">
        <DotLine spotsLeft={a.spotsLeft} size={14} text={`${a.spotsTaken} of ${a.capacity} booked · ${plansCount} ${plansCount === 1 ? "group" : "groups"}`} />
        <LiveTag />
      </div>
      <Bar spotsLeft={a.spotsLeft} capacity={a.capacity} />
      <div className="flex items-center gap-4">
        <TextLink href={`/host?activity=${a.id}`}>Live attendance</TextLink>
        {a.invitesEnabled && (
          <TextButton onClick={() => share.mutate()} disabled={share.isPending} muted={copied}>
            {copied ? "Link copied" : "Share link"}
          </TextButton>
        )}
      </div>
    </article>
  );
}
