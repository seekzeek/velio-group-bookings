"use client";

import { Link2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { Button, ButtonLink, Notice, Spinner, inputClass } from "@/components/bits";
import { PhotoCarousel } from "@/components/gallery";
import { useInviteTools } from "@/components/invite-panel";
import type { Activity } from "@/lib/api";
import { formatDay, formatMoney, formatTime, formatWhen, spotsText } from "@/lib/format";
import { BottomBar, CalendarIcon, ChevronLeft, CircleButton, H1, IconBox, IconRow, PhoneToast, PinIcon, Screen, Sheet, SpotsCard, Tick, UsersIcon } from "./bits";

export type ActivityState = "available" | "soldOut" | "booked" | "bookedHoldout" | "started";

type Props = {
  activity: Activity;
  state: ActivityState;
  live: boolean;
  toast: string | null;
  onToastDone: () => void;
  onBook: () => void;
  booking: boolean;
  soldOutJustNow: boolean;
  otherDate: Activity | null;
  watching: boolean;
  onWatch: () => void;
  added: boolean;
  onAddCalendar: () => void;
};

/** The activity on a phone: the cover with a back button, the facts, the spots card, and a bar at the bottom with the price and the one action. */
export function MobileActivity(props: Props) {
  if (props.state === "booked" || props.state === "bookedHoldout") return <GoingScreen {...props} />;
  const { activity: a, state, live, toast, onToastDone, onBook, booking, soldOutJustNow, otherDate, watching, onWatch } = props;
  return (
    <Screen>
      <div className="relative h-[260px] shrink-0">
        <PhotoCarousel illustration={a.illustration} photos={a.photos} />
        <CircleButton href="/explore" label="Back to Explore" className="absolute left-5 top-3">
          <ChevronLeft />
        </CircleButton>
        <PhoneToast message={toast} onDone={onToastDone} />
      </div>
      <div className="flex flex-col gap-2.5 px-5 pt-5">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-muted-ink">
          <Avatar name={a.host.displayName} size={24} colour="#2F6D3A" /> Hosted by {a.host.displayName}
        </span>
        <H1 size={32}>{a.title}</H1>
        <p className="text-[15px] leading-relaxed text-body">{a.description}</p>
        <div className="flex flex-col gap-2 pt-0.5">
          <IconRow icon={<CalendarIcon />}>{formatWhen(a.startsAt, a.timezone)} local time</IconRow>
          <IconRow icon={<PinIcon />}>{a.location}</IconRow>
          <IconRow icon={<UsersIcon />}>
            {a.plansCount} {a.plansCount === 1 ? "group" : "groups"} going
          </IconRow>
        </div>
      </div>
      <SpotsCard className="mx-5 mt-4" spotsLeft={state === "soldOut" ? 0 : a.spotsLeft} capacity={a.capacity} live={live} hint={a.invitesEnabled ? "You can invite friends as soon as you've booked." : "Book a spot and it's yours."} />
      {state === "soldOut" && (
        <div className="mx-5 mt-4">
          <Notice title={soldOutJustNow ? "Someone got there a second before you" : "This one's full"} body={`${soldOutJustNow ? "The last spot went while you were booking, so you haven't been booked." : `All ${a.capacity} spots are taken.`}${otherDate ? ` ${a.host.displayName} has another date with room.` : ""}`} />
        </div>
      )}
      {state === "started" && (
        <div className="mx-5 mt-4">
          <Notice title="This one has already started" body="Here's what's coming up instead." />
        </div>
      )}
      <div className="h-6" />
      <BottomBar className="gap-4">
        <span className="flex flex-col">
          <span className="text-[22px] font-bold tracking-[-0.01em]">{formatMoney(a.price)}</span>
          <span className="text-xs font-medium text-muted-ink">per spot, paid on the day</span>
        </span>
        {state === "available" && (
          <Button size="cta" className="flex-1" onClick={onBook} disabled={booking} aria-busy={booking}>
            {booking ? (
              <>
                <Spinner /> Booking…
              </>
            ) : (
              "Book my spot"
            )}
          </Button>
        )}
        {state === "soldOut" &&
          (otherDate ? (
            <ButtonLink href={`/activities/${otherDate.id}`} size="cta" className="flex-1 text-base">
              {formatDay(otherDate.startsAt, otherDate.timezone)} · {otherDate.spotsLeft} left
            </ButtonLink>
          ) : (
            <Button size="cta" variant={watching ? "tint" : "outline"} className="flex-1 text-base shadow-none" onClick={onWatch}>
              {watching ? "We'll tell you if a spot opens" : "Tell me if a spot opens"}
            </Button>
          ))}
        {state === "started" && (
          <ButtonLink href="/explore" size="cta" className="flex-1 text-base">
            See what&apos;s coming up
          </ButtonLink>
        )}
      </BottomBar>
    </Screen>
  );
}

/** "You're going": the tick, the plan in one line, the spots card, then bring a friend or add to calendar. */
function GoingScreen({ activity: a, state, live, added, onAddCalendar }: Props) {
  const [sheet, setSheet] = useState(false);
  return (
    <Screen>
      <div className="flex flex-col items-center gap-4 px-5 pt-14 text-center">
        <span className="flex size-[72px] items-center justify-center rounded-full bg-brand text-white">
          <Tick size={34} />
        </span>
        <H1>You&apos;re going</H1>
        <p className="max-w-[300px] text-[15px] leading-relaxed text-body">
          {a.title}, {formatDay(a.startsAt, a.timezone)} at {formatTime(a.startsAt, a.timezone)}. {a.location}.
        </p>
      </div>
      <SpotsCard className="mx-5 mt-6" spotsLeft={a.spotsLeft} capacity={a.capacity} live={live} hint="First come, first served. Invites don't hold a spot." />
      <div className="h-6" />
      <BottomBar column>
        {state === "booked" ? (
          <Button size="cta" block className="shadow-none" onClick={() => setSheet(true)} disabled={a.spotsLeft <= 0}>
            {a.spotsLeft <= 0 ? "It's full now" : "Bring a friend"}
          </Button>
        ) : (
          <Button size="cta" block variant={added ? "tint" : "primary"} onClick={onAddCalendar}>
            {added ? "Added to calendar" : "Add to calendar"}
          </Button>
        )}
        <ButtonLink href="/plans" size="soft" variant="outline" block className="font-semibold">
          See it in My plans
        </ButtonLink>
      </BottomBar>
      {state === "booked" && (
        <Sheet open={sheet} onClose={() => setSheet(false)} label="Who's coming with you?">
          <InviteSheet activity={a} onLater={() => setSheet(false)} />
        </Sheet>
      )}
    </Screen>
  );
}

/** The sheet from the canvas: vouch for a friend (then the sent card), share a link, "Later". */
function InviteSheet({ activity: a, onLater }: { activity: Activity; onLater: () => void }) {
  const t = useInviteTools(a);
  return (
    <>
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl leading-[1.1] tracking-[-0.02em]">Who&apos;s coming with you?</h2>
        <span className={`text-sm font-bold ${a.spotsLeft <= 3 ? "text-scarcity-text" : "text-brand-deep"}`}>{spotsText(a.spotsLeft, a.capacity)}, first come first served.</span>
      </div>

      {t.sent ? (
        <div className="flex flex-col gap-3 rounded-[20px] bg-surface p-[18px] shadow-[var(--shadow-card)]">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-white">
              <Tick />
            </span>
            <span className="flex flex-col gap-[3px]">
              <span className="text-base font-bold">Vouch sent{t.sent.recipientLabel ? ` to ${t.sent.recipientLabel}` : ""}</span>
              <span className="text-[13px] leading-snug text-muted-ink">Only the number or email you entered can claim it, so it&apos;s safe to send the link however you like.</span>
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="mVouchLink" className="text-xs font-bold uppercase tracking-[0.06em] text-muted-ink">
              {t.sent.recipientLabel ?? "Their"} link · code {t.sent.codeDisplay}
            </label>
            <div className="flex gap-2">
              <input id="mVouchLink" readOnly value={t.sent.url} className={`${inputClass} bg-[#F7F8F7] px-3`} />
              <Button size="field" variant="outline" className="px-3.5 text-sm" onClick={() => t.copy(t.sent!.url, "vouch", t.sent!.code)}>
                {t.copied === "vouch" ? "Copied" : "Copy"}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button size="row" className="flex-1 px-3" onClick={() => t.share(t.sent!)}>
                <Link2 className="size-4" /> Share link
              </Button>
              <Button size="row" variant="outline" className="flex-1 px-3" onClick={() => t.setSent(null)}>
                Vouch for someone else
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <form
          className="flex flex-col gap-3 rounded-[20px] bg-surface p-[18px] shadow-[var(--shadow-card)]"
          onSubmit={(e) => {
            e.preventDefault();
            t.vouch.mutate();
          }}
        >
          <div className="flex items-start gap-3">
            <IconBox>
              <ShieldCheck className="size-5" />
            </IconBox>
            <span className="flex flex-col gap-[3px]">
              <span className="text-base font-bold">Vouch for a friend</span>
              <span className="text-[13px] leading-snug text-muted-ink">For one person. It shows your name, and only they can claim it.</span>
            </span>
          </div>
          <label htmlFor="mVouchName" className="text-[13px] font-semibold">
            Who&apos;s it for? <span className="font-medium text-muted-ink">Only you see this</span>
          </label>
          <input id="mVouchName" value={t.label} onChange={(e) => t.setLabel(e.target.value)} maxLength={40} className={`${inputClass} h-12 text-base`} />
          <label htmlFor="mVouchTo" className="text-[13px] font-semibold">
            Their phone number or email
          </label>
          <input id="mVouchTo" value={t.contact} onChange={(e) => t.setContact(e.target.value)} autoComplete="off" inputMode="email" className={`${inputClass} h-12 text-base`} aria-invalid={!!t.error} />
          {t.error && (
            <span role="alert" className="text-[13px] font-semibold text-scarcity-text">
              {t.error}
            </span>
          )}
          <Button type="submit" size="wide" className="rounded-[14px] text-base shadow-[var(--shadow-cta)]" block disabled={t.vouch.isPending || !t.contact}>
            {t.vouch.isPending ? "Sending…" : "Send vouch"}
          </Button>
        </form>
      )}

      <div className="flex flex-col gap-3 rounded-[20px] bg-surface p-[18px] shadow-[var(--shadow-card)]">
        <div className="flex items-start gap-3">
          <IconBox tone="grey">
            <Link2 className="size-5" />
          </IconBox>
          <span className="flex flex-col gap-[3px]">
            <span className="text-base font-bold">Share a link</span>
            <span className="text-[13px] leading-snug text-muted-ink">Post it in a group chat. Anyone with it can join your plan while spots last.</span>
          </span>
        </div>
        <Button size="wide" variant="outline" block className="rounded-[14px] text-base" onClick={t.shareOrCreateLink} disabled={t.link.isPending}>
          <Link2 className="size-4" /> {t.copied === "link" ? "Link copied" : "Share"}
        </Button>
      </div>

      <button type="button" onClick={onLater} className="inline-flex min-h-11 items-center self-center text-[15px] font-semibold text-ink">
        Later
      </button>
      <Link href="/plans" className="sr-only">
        See it in My plans
      </Link>
    </>
  );
}
