"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, MapPin, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Avatar, AvatarStack } from "@/components/avatar";
import { Card, CardSkeleton, Cta, ErrorState, Field, SecondaryButton, Spinner, inputClass } from "@/components/bits";
import { Cover } from "@/components/cover";
import { PageShell } from "@/components/page-shell";
import { SpotsLine } from "@/components/spots-line";
import { Checkbox } from "@/components/ui/checkbox";
import { OtherDates } from "@/components/other-dates";
import { api, type ClaimResult, type Member, type ResolvedInvite } from "@/lib/api";
import { downloadCalendar } from "@/lib/calendar";
import { isApiError, type ErrorCode } from "@/lib/errors";
import { track } from "@/lib/events";
import { formatDay, formatMoney, formatTime, formatWhen, listNames } from "@/lib/format";
import { useLiveAvailability } from "@/lib/use-live-availability";
import { useUser } from "@/lib/user-context";

type Step = "invite" | "details" | "done";

const statusErrors: Record<Exclude<ResolvedInvite["status"], "open">, ErrorCode> = { expired: "INVITE_EXPIRED", used: "INVITE_USED", revoked: "INVITE_REVOKED", started: "ACTIVITY_STARTED", off: "INVITES_OFF" };

export default function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const { userId, anonId, ready, setUserId } = useUser();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("invite");
  const [result, setResult] = useState<ClaimResult | null>(null);
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  const query = useQuery({ queryKey: ["invite", code, userId], queryFn: () => api.invite(code, userId), enabled: ready, retry: false });
  const invite = query.data;
  const activityId = invite?.activity.id ?? null;

  // Keep the activity cache for the stream in step with the invite's own copy.
  useEffect(() => {
    if (invite) queryClient.setQueryData(["activity", invite.activity.id], { activity: { ...invite.activity, viewer: null } });
  }, [invite, queryClient]);
  const live = useLiveAvailability(activityId);
  const liveActivity = useQuery({ queryKey: ["activity", activityId], queryFn: () => api.activity(activityId!, userId, anonId), enabled: !!activityId });
  const spotsLeft = liveActivity.data?.activity.spotsLeft ?? invite?.activity.spotsLeft ?? 0;

  useEffect(() => {
    if (!invite || !anonId) return;
    track({ name: "invite_opened", anonId, userId, inviteCode: invite.code, props: { spotsLeftAtOpen: invite.activity.spotsLeft } });
    // Try the app once on a phone; if nothing handles the scheme the page simply stays.
    if (/android|iphone|ipad/i.test(navigator.userAgent)) {
      const frame = document.createElement("iframe");
      frame.style.display = "none";
      frame.src = `velio://i/${invite.code}`;
      document.body.appendChild(frame);
      setTimeout(() => frame.remove(), 1500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invite?.code, anonId]);

  if (query.isError) {
    return (
      <PageShell>
        <div className="mx-auto max-w-md pt-6">
          <ErrorState code={isApiError(query.error) ? query.error.code : "TRY_AGAIN"} />
        </div>
      </PageShell>
    );
  }
  if (!invite) {
    return (
      <PageShell>
        <div className="mx-auto max-w-md pt-6">
          <CardSkeleton lines={4} />
        </div>
      </PageShell>
    );
  }

  if (step === "done" && result) {
    return (
      <PageShell>
        <YoureIn invite={invite} result={result} />
      </PageShell>
    );
  }

  if (invite.status !== "open") {
    return (
      <PageShell>
        <div className="mx-auto flex max-w-md flex-col gap-5 pt-6">
          <InviterRow invite={invite} />
          <ErrorState code={statusErrors[invite.status]} />
          {invite.status === "off" && (
            <Link href={`/activities/${invite.activity.id}`} className="text-sm font-bold text-brand">
              Book a spot directly
            </Link>
          )}
        </div>
      </PageShell>
    );
  }

  if (invite.viewer?.alreadyInPlan) {
    return (
      <PageShell>
        <div className="mx-auto flex max-w-md flex-col gap-5 pt-6">
          <InviterRow invite={invite} />
          <ErrorState code="ALREADY_BOOKED" action={<Link href={`/activities/${invite.activity.id}`} className="text-sm font-bold text-brand">See your plan</Link>} />
        </div>
      </PageShell>
    );
  }

  if (spotsLeft <= 0) {
    return (
      <PageShell>
        <FilledUp invite={invite} />
      </PageShell>
    );
  }

  if (step === "details") {
    return (
      <PageShell>
        <Details
          invite={invite}
          idempotencyKey={idempotencyKey}
          onBack={() => setStep("invite")}
          onClaimed={(r) => {
            setResult(r);
            setUserId(r.userId);
            setStep("done");
          }}
          onFull={() => queryClient.invalidateQueries({ queryKey: ["activity", activityId] })}
        />
      </PageShell>
    );
  }

  const a = invite.activity;
  return (
    <PageShell>
      <div className="mx-auto flex max-w-md flex-col gap-4 pt-2">
        <div className="flex items-center justify-between">
          <span className="font-heading text-xl font-bold">velio</span>
          <span className="text-sm font-semibold text-muted-ink">Invite {invite.codeDisplay}</span>
        </div>
        <InviterRow invite={invite} />
        {invite.rail === "vouch" && (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-tint px-2.5 py-1.5 text-xs font-bold text-brand-deep">
            <ShieldCheck className="size-4" /> Vouch · only you can claim this
          </span>
        )}
        <Card className="overflow-hidden">
          <div className="h-40">
            <Cover illustration={a.illustration} photos={a.photos} />
          </div>
          <div className="flex flex-col gap-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-2xl sm:text-3xl">{a.title}</h1>
              <span className="pt-1 font-bold">{formatMoney(a.price)}</span>
            </div>
            <div className="flex flex-col gap-2 text-sm text-body">
              <span className="inline-flex items-center gap-2.5">
                <CalendarDays className="size-4" /> {formatWhen(a.startsAt, a.timezone)} local time
              </span>
              <span className="inline-flex items-center gap-2.5">
                <MapPin className="size-4" /> {a.location}
              </span>
            </div>
            <div className="border-t border-line pt-3.5">
              <SpotsLine spotsLeft={spotsLeft} capacity={a.capacity} live={live.connected} />
            </div>
          </div>
        </Card>
        <PlanRow invite={invite} />
        <div className="sticky bottom-0 -mx-4 mt-auto flex flex-col gap-2.5 bg-surface px-4 pb-6 pt-3 shadow-[0_-1px_0_var(--line)] sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:shadow-none">
          <Cta onClick={() => setStep("details")}>Claim your spot</Cta>
          <span className="text-center text-xs font-semibold text-muted-ink">Nothing is charged in the app. You pay the host on the day.</span>
        </div>
      </div>
    </PageShell>
  );
}

function InviterRow({ invite }: { invite: ResolvedInvite }) {
  const name = invite.inviter.displayName;
  const headline = invite.isHostInvite
    ? invite.rail === "vouch"
      ? `${name}, the host, vouched for you`
      : `${name}, the host, shared this with you`
    : invite.rail === "vouch"
      ? `${name} vouched for you`
      : `${name} shared this with you`;
  const sub = invite.isHostInvite
    ? `${name} is running this and wants you there. You'll start your own group.`
    : invite.rail === "vouch"
      ? `${name} is going and saved this invite just for you.`
      : `${name} is going. Anyone with this link can join while spots last.`;
  return (
    <div className="flex items-center gap-3">
      <Avatar name={name} size={48} colour={invite.isHostInvite ? "#2F6D3A" : undefined} />
      <span className="flex flex-col gap-0.5">
        <span className="text-[17px] font-bold leading-tight">{headline}</span>
        <span className="text-sm text-muted-ink">{sub}</span>
      </span>
    </div>
  );
}

function PlanRow({ invite }: { invite: ResolvedInvite }) {
  if (!invite.plan) {
    const n = invite.activity.plansCount;
    return (
      <div className="flex items-center gap-2.5 text-sm text-body">
        <AvatarStack names={[invite.inviter.displayName]} />
        {invite.inviter.displayName} is hosting · {n} {n === 1 ? "group" : "groups"} going so far
      </div>
    );
  }
  const names = invite.plan.members.map((m) => m.displayName);
  return (
    <div className="flex items-center gap-2.5 text-sm text-body">
      <AvatarStack names={names} />
      {listNames(names)} {names.length === 1 ? "is" : "are"} in this plan
    </div>
  );
}

function Details({ invite, idempotencyKey, onBack, onClaimed, onFull }: { invite: ResolvedInvite; idempotencyKey: string; onBack: () => void; onClaimed: (r: ClaimResult) => void; onFull: () => void }) {
  const { userId, anonId } = useUser();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [error, setError] = useState<{ code: ErrorCode; message: string } | null>(null);
  const me = useQuery({ queryKey: ["me", userId], queryFn: () => api.me(userId!), enabled: !!userId, retry: false });
  const known = me.data?.user ?? null;
  const inviter = invite.inviter.displayName;

  useEffect(() => {
    track({ name: "claim_started", anonId, userId, inviteCode: invite.code });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const claim = useMutation({
    mutationFn: () =>
      api.claim(invite.code, { idempotencyKey, displayName: known ? undefined : name, contact: contact || undefined, platform: "web", anonId }, known ? userId : null),
    onSuccess: onClaimed,
    onError: (err) => {
      if (isApiError(err) && err.code === "SOLD_OUT") return onFull();
      if (isApiError(err)) {
        const fields = (err.details?.fields as Record<string, string> | undefined) ?? {};
        setError({ code: err.code, message: fields.contact ?? fields.displayName ?? err.message });
      } else setError({ code: "TRY_AGAIN", message: "Something went wrong on our side. Try again." });
    },
  });

  const a = invite.activity;
  const contactError = error && (error.code === "INVITE_NOT_FOR_YOU" || error.code === "VALIDATION");
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 pt-2">
      <button type="button" onClick={onBack} aria-label="Back to the invite" className="flex size-11 items-center justify-center rounded-full bg-surface shadow-[var(--shadow-card)]">
        <ChevronLeft className="size-5" />
      </button>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl">Almost there</h1>
        <p className="text-body">
          {known
            ? `You're claiming as ${known.displayName}.${invite.rail === "vouch" && !known.hasContact ? ` Add the number or email ${inviter} used so we can match the vouch.` : ""}`
            : `Tell us who you are so ${inviter}${invite.isHostInvite ? "" : " and the host"} ${invite.isHostInvite ? "knows" : "know"} who's coming. This also sets up your Velio account, so your plans are here next time. No password.`}
        </p>
      </div>
      <div className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3 shadow-[var(--shadow-card)]">
        <span className="flex flex-col">
          <span className="font-bold">{a.title}</span>
          <span className="text-sm text-body">{formatWhen(a.startsAt, a.timezone)}</span>
        </span>
        <span className="text-sm font-bold text-scarcity-text">{a.spotsLeft} left</span>
      </div>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          track({ name: "claim_submitted", anonId, userId, inviteCode: invite.code });
          claim.mutate();
        }}
      >
        {!known && (
          <Field label="Your name" htmlFor="name" error={error?.code === "VALIDATION" && !contactError ? error.message : undefined}>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" required maxLength={60} className={inputClass} />
          </Field>
        )}
        {(!known || invite.rail === "vouch") && (
          <Field
            label="Phone number or email"
            htmlFor="contact"
            error={contactError ? (error.code === "INVITE_NOT_FOR_YOU" ? `This invite was sent to a different number or email. Check with ${inviter} which one they used.` : error.message) : undefined}
            hint={
              invite.rail === "vouch"
                ? `${inviter}'s vouch is tied to this, so use the same number or email they have for you. We only keep a scrambled version of it.`
                : "We'll use this to find your plans next time. We only keep a scrambled version of it."
            }
          >
            <input
              id="contact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder={invite.rail === "vouch" ? `The one ${inviter} sent this to` : "Phone number or email"}
              autoComplete="tel"
              required={!known || !known.hasContact}
              aria-invalid={!!contactError}
              className={inputClass}
            />
          </Field>
        )}
        {error && !contactError && (
          <div role="alert" className="rounded-2xl bg-warning-bg p-4 text-sm font-semibold text-warning-text">
            {error.message}
          </div>
        )}
        <Cta type="submit" disabled={claim.isPending} aria-busy={claim.isPending}>
          {claim.isPending ? (
            <>
              <Spinner /> Claiming…
            </>
          ) : (
            "Claim my spot"
          )}
        </Cta>
      </form>
    </div>
  );
}

function YoureIn({ invite, result }: { invite: ResolvedInvite; result: ClaimResult }) {
  const { userId } = useUser();
  const [remind, setRemind] = useState(true);
  const [follow, setFollow] = useState(false);
  const [added, setAdded] = useState(false);
  const a = result.activity;
  const own = invite.isHostInvite;
  const followName = own ? invite.inviter.displayName : result.plan.owner.displayName;
  const prefs = useMutation({ mutationFn: (body: { remindDayBefore?: boolean; friendUpdates?: boolean }) => api.updatePreferences(result.userId, body) });

  const describe = (m: Member) => {
    if (m.userId === result.userId) return own ? "Started a group" : "Just joined";
    if (m.role === "owner") return "Started the plan";
    return "Going";
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 pt-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl">{own ? "You're in. Your own group starts here" : `You're in ${result.plan.owner.displayName}'s plan`}</h1>
        <p className="text-body">
          {a.title}, {formatDay(a.startsAt, a.timezone)} at {formatTime(a.startsAt, a.timezone)}. Your spot is saved.
        </p>
      </div>
      <Card className="flex flex-col divide-y divide-line">
        {result.plan.members.map((m) => (
          <div key={m.userId} className="flex items-center gap-3 px-4 py-3">
            <Avatar name={m.displayName} />
            <span className="flex-1 font-bold">
              {m.displayName}
              {m.userId === result.userId ? " (you)" : ""}
            </span>
            <span className="text-sm text-muted-ink">{describe(m)}</span>
          </div>
        ))}
      </Card>
      <SpotsLine spotsLeft={a.spotsLeft} capacity={a.capacity} />
      <div role="group" aria-label="Messages from Velio" className="flex flex-col gap-3">
        <label className="flex items-center gap-3 text-[15px] font-semibold">
          <Checkbox
            checked={remind}
            onCheckedChange={(v) => {
              setRemind(!!v);
              prefs.mutate({ remindDayBefore: !!v });
            }}
          />
          Remind me the day before
        </label>
        <label className="flex items-center gap-3 text-[15px] font-semibold">
          <Checkbox
            checked={follow}
            onCheckedChange={(v) => {
              setFollow(!!v);
              prefs.mutate({ friendUpdates: !!v });
            }}
          />
          Tell me when {followName} plans something new
        </label>
      </div>
      <div className="flex flex-col gap-3">
        <span className="text-sm font-semibold text-body">Someone you&apos;d want there too? Spots are going.</span>
        {a.invitesEnabled && (
          <Link href={`/activities/${a.id}#invite`} className="flex h-14 items-center justify-center rounded-2xl bg-brand text-[17px] font-bold text-white shadow-[var(--shadow-cta)]">
            Bring a friend
          </Link>
        )}
        <SecondaryButton active={added} onClick={() => { downloadCalendar(a); setAdded(true); }}>
          {added ? "Added to calendar" : "Add to calendar"}
        </SecondaryButton>
        {userId && (
          <Link href="/plans" className="text-center text-sm font-bold text-brand">
            See it in My plans
          </Link>
        )}
      </div>
    </div>
  );
}

function FilledUp({ invite }: { invite: ResolvedInvite }) {
  const { userId, anonId } = useUser();
  const [watching, setWatching] = useState(false);
  const [told, setTold] = useState(false);
  const a = invite.activity;
  const name = invite.inviter.displayName;
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 pt-2">
      <div className="flex items-center justify-between">
        <span className="font-heading text-xl font-bold">velio</span>
        <span className="text-sm font-semibold text-muted-ink">Invite {invite.codeDisplay}</span>
      </div>
      <div className="flex items-center gap-3 text-sm text-body">
        <Avatar name={name} size={40} />
        <span>
          {name} wanted you on <strong>{a.title}</strong> on {formatDay(a.startsAt, a.timezone)}.
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl">This one filled up before you got here</h1>
        <p className="text-body">Your invite is still good. If someone drops out, we&apos;ll tell you straight away and you can take their spot.</p>
      </div>
      <SpotsLine spotsLeft={0} capacity={a.capacity} />
      <Cta
        className={watching ? "bg-brand-tint text-brand-deep shadow-none" : ""}
        onClick={() => {
          setWatching(true);
          api.watch(a.id, { anonId, platform: "web" }, userId).catch(() => undefined);
        }}
      >
        {watching ? "We'll tell you if a spot opens" : "Tell me if a spot opens"}
      </Cta>
      <OtherDates hostId={a.host.id} excludeId={a.id} label="Same host, other dates" />
      <button
        type="button"
        onClick={() => {
          setTold(true);
          track({ name: "invite_missed", anonId, userId, inviteCode: invite.code, activityId: a.id });
        }}
        className={`text-sm font-bold ${told ? "text-muted-ink" : "text-brand"}`}
      >
        {told ? `${name} knows you missed it` : `Let ${name} know you missed it`}
      </button>
    </div>
  );
}
