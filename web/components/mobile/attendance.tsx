"use client";

import { Inbox } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Button, Chip, TextButton } from "@/components/bits";
import { Cover } from "@/components/cover";
import type { Attendance, Member } from "@/lib/api";
import { categoryLabels, formatMoney, formatWhen } from "@/lib/format";
import { BottomBar, CalendarIcon, ChevronLeft, CircleButton, CoinIcon, EmptyBlock, H1, IconRow, PinIcon, Screen, SpotsCard, Stack, UsersIcon } from "./bits";

type Props = {
  data: Attendance;
  live: boolean;
  userId: string | null;
  openedAt: number;
  onVouch: () => void;
  onShare: () => void;
  sharing: boolean;
  copied: boolean;
  onEditPhotos: () => void;
};

function memberLine(m: Member, viewerId: string | null) {
  if (m.joinedVia === "vouch" && m.invitedBy?.id === viewerId) return `${m.displayName} (vouched by you)`;
  return m.displayName;
}

/** Live attendance on a phone: the activity card, the big booked count, one row per group, and Vouch plus Share link pinned at the bottom. */
export function MobileAttendance({ data, live, userId, openedAt, onVouch, onShare, sharing, copied, onEditPhotos }: Props) {
  const a = data.activity;
  const t = data.totals;
  return (
    <Screen>
      <div className="flex items-center justify-between px-5 pt-3">
        <CircleButton href="/plans?tab=hosting" label="Back to My plans">
          <ChevronLeft />
        </CircleButton>
        <Chip tone="ink" className="px-3 py-1.5">
          You&apos;re hosting
        </Chip>
      </div>
      <div className="flex flex-col gap-1.5 px-5 pt-4">
        <H1 size={28}>{a.title}</H1>
        <span className="text-sm text-muted-ink">{categoryLabels[a.category]}</span>
      </div>
      <div className="mx-5 mt-4 overflow-hidden rounded-[20px] bg-surface shadow-[var(--shadow-card)]">
        <div className="h-[150px]">
          <Cover illustration={a.illustration} photos={a.photos} />
        </div>
        <div className="flex flex-col gap-3 p-4">
          <p className="text-sm leading-relaxed text-body">{a.description}</p>
          <div className="flex flex-col gap-2">
            <IconRow icon={<CalendarIcon />}>{formatWhen(a.startsAt, a.timezone)} local time</IconRow>
            <IconRow icon={<PinIcon />}>{a.location}</IconRow>
            <IconRow icon={<CoinIcon />}>{formatMoney(a.price)} per spot, collected by you on the day</IconRow>
            <IconRow icon={<UsersIcon />}>{a.capacity} spots in total, across every group</IconRow>
          </div>
          <TextButton onClick={onEditPhotos} className="self-start">
            Edit photos
          </TextButton>
        </div>
      </div>
      <SpotsCard className="mx-5 mt-4" big spotsLeft={t.spotsLeft} capacity={t.capacity} live={live} text={`${t.booked} of ${t.capacity} booked`} hint={t.plansCount === 0 ? "No groups yet" : `${t.plansCount} ${t.plansCount === 1 ? "group" : "groups"} · ${t.viaInvites.total} came through invites`} />

      {data.plans.length === 0 ? (
        <EmptyBlock icon={<Inbox className="size-7" />} title="No bookings yet" body="It's on Explore. Share the link or vouch for someone to get the first group started." className="pt-12" />
      ) : (
        <div className="flex flex-col gap-2.5 px-5 pt-6">
          <h2 className="font-sans text-xs font-bold uppercase tracking-[0.06em] text-muted-ink">Who&apos;s coming, by group</h2>
          {data.plans.map((plan) =>
            plan.membersCount === 1 ? (
              <div key={plan.id} className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 shadow-[var(--shadow-card)]">
                <Avatar name={plan.owner.displayName} size={30} className="border-2 border-surface" />
                <span className="flex-1 text-[15px] font-bold">{plan.owner.displayName} · 1</span>
                <span className="text-[13px] text-muted-ink">Solo so far</span>
              </div>
            ) : (
              <div key={plan.id} className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 shadow-[var(--shadow-card)]">
                <Stack names={plan.members.map((m) => m.displayName)} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-bold">
                    {plan.owner.displayName}&apos;s group · {plan.membersCount}
                  </span>
                  <span className="text-[13px] text-muted-ink">{plan.members.map((m) => memberLine(m, userId)).join(", ")}</span>
                </span>
                {openedAt - new Date(plan.latestJoinAt).getTime() < 3_600_000 && <Chip tone="ok">New</Chip>}
              </div>
            ),
          )}
        </div>
      )}
      <div className="h-6" />
      {a.invitesEnabled && (
        <BottomBar>
          <Button size="cta" variant="outline" className="flex-1 text-base shadow-none" onClick={onVouch}>
            Vouch
          </Button>
          <Button size="cta" variant={copied ? "tint" : "primary"} className="flex-1 text-base shadow-none" onClick={onShare} disabled={sharing}>
            {copied ? "Link copied" : "Share link"}
          </Button>
        </BottomBar>
      )}
    </Screen>
  );
}
