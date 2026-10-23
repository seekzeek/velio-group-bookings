"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CalendarCheck, CalendarDays, Check, ChevronLeft, MapPin, ShieldCheck, WifiOff } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Avatar, AvatarStack } from "@/components/avatar";
import { Wordmark } from "@/components/wordmark";
import { Button, ButtonLink, Card, Dot, ErrorState, Field, Skeleton, Spinner, TextLink, guestInputClass } from "@/components/bits";
import { PhotoCarousel } from "@/components/gallery";
import { OtherDates } from "@/components/other-dates";
import { PageShell } from "@/components/page-shell";
import { SpotsLine } from "@/components/spots-line";
import { api, type ClaimResult, type Member, type ResolvedInvite } from "@/lib/api";
import { downloadCalendar } from "@/lib/calendar";
import { isApiError, type ErrorCode } from "@/lib/errors";
import { track } from "@/lib/events";
import { formatDay, formatMoney, formatTime, formatWhen, listNames } from "@/lib/format";
import { useLiveAvailability } from "@/lib/use-live-availability";
import { useUser } from "@/lib/user-context";
import { cn } from "@/lib/utils";

type Step = "invite" | "details" | "done";

type Saved = { invite: ResolvedInvite; savedAt: string };
type Draft = { name: string; contact: string };

// The last good copy of the invite and whatever the guest typed, so the page still means something with no connection.
const inviteKey = (code: string) => `velio.invite.${code.toUpperCase()}`;
const draftKey = (code: string) => `velio.claimDraft.${code.toUpperCase()}`;
function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or a full store. The page works without it.
  }
}
const displayCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^(.{4})(.{4})$/, "$1-$2");

const statusErrors: Record<Exclude<ResolvedInvite["status"], "open">, ErrorCode> = { expired: "INVITE_EXPIRED", used: "INVITE_USED", revoked: "INVITE_REVOKED", started: "ACTIVITY_STARTED", off: "INVITES_OFF" };

/** The guest journey from the canvas, in a phone-width column: invite, details, you're in, and every other state. */
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

  useEffect(() => {
    if (invite) writeJson(inviteKey(code), { invite, savedAt: new Date().toISOString() } satisfies Saved);
  }, [invite, code]);

  useEffect(() => {
    const back = () => void query.refetch();
    window.addEventListener("online", back);
    return () => window.removeEventListener("online", back);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const column = (children: React.ReactNode) => (
    <PageShell width={760}>
      <div className="mx-auto flex min-h-[70dvh] max-w-[390px] flex-col">{children}</div>
    </PageShell>
  );

  if (query.isError) {
    const unreachable = isApiError(query.error) && query.error.status === 0;
    // Read at failure time, not on mount: the copy is usually written by the load that just succeeded.
    const saved = readJson<Saved>(inviteKey(code));
    if (unreachable && saved) return column(<Offline invite={saved.invite} savedAt={saved.savedAt} draft={readJson<Draft>(draftKey(code))} />);
    return column(<ErrorState code={isApiError(query.error) ? query.error.code : "TRY_AGAIN"} />);
  }
  if (!invite) return column(<Loading code={displayCode(code)} />);
  if (step === "done" && result) return column(<YoureIn invite={invite} result={result} />);

  if (invite.status !== "open") {
    return column(
      <div className="flex flex-col gap-5">
        <Header code={invite.codeDisplay} />
        <InviterRow invite={invite} />
        <ErrorState code={statusErrors[invite.status]} action={invite.status === "off" ? <TextLink href={`/activities/${invite.activity.id}`}>Book a spot directly</TextLink> : undefined} />
      </div>,
    );
  }

  if (invite.viewer?.alreadyInPlan) {
    return column(
      <div className="flex flex-col gap-5">
        <Header code={invite.codeDisplay} />
        <InviterRow invite={invite} />
        <ErrorState code="ALREADY_BOOKED" action={<TextLink href={`/activities/${invite.activity.id}`}>See your plan</TextLink>} />
      </div>,
    );
  }

  if (spotsLeft <= 0) return column(<FilledUp invite={invite} />);

  if (step === "details") {
    return column(
      <Details
        invite={invite}
        spotsLeft={spotsLeft}
        idempotencyKey={idempotencyKey}
        onBack={() => setStep("invite")}
        onClaimed={(r) => {
          setResult(r);
          setUserId(r.userId);
          setStep("done");
        }}
        onFull={() => queryClient.invalidateQueries({ queryKey: ["activity", activityId] })}
      />,
    );
  }

  const a = invite.activity;
  return column(
    <>
      <Header code={invite.codeDisplay} />
      <div className="mt-6">
        <InviterRow invite={invite} />
      </div>
      {invite.rail === "vouch" && (
        <span className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-tint px-2.5 py-1.5 text-[13px] font-bold text-brand-deep">
          <ShieldCheck className="size-4" /> Vouch · only you can claim this
        </span>
      )}
      <Card className="mt-4 overflow-hidden">
        <div className="h-40">
          <PhotoCarousel illustration={a.illustration} photos={a.photos} />
        </div>
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-[28px] leading-[1.05] tracking-[-0.025em]">{a.title}</h1>
            <span className="pt-1 text-[17px] font-bold">{formatMoney(a.price)}</span>
          </div>
          <div className="flex flex-col gap-2 text-sm text-body">
            <span className="inline-flex items-center gap-2.5">
              <CalendarDays className="size-4" /> {formatWhen(a.startsAt, a.timezone)} local time
            </span>
            <span className="inline-flex items-center gap-2.5">
              <MapPin className="size-4" /> {a.location}
            </span>
          </div>
          <div className="border-t border-[#EEF0F2] pt-3.5">
            <SpotsLine spotsLeft={spotsLeft} capacity={a.capacity} live={live.connected} />
          </div>
        </div>
      </Card>
      <div className="mt-4">
        <PlanRow invite={invite} />
      </div>
      <Footer>
        <Button size="cta" block onClick={() => setStep("details")}>
          Claim your spot
        </Button>
        <span className="text-center text-xs font-medium text-muted-ink">Nothing is charged in the app. You pay the host on the day.</span>
      </Footer>
    </>,
  );
}

/** The loading state from the canvas: the header, a grey inviter row, a grey card and a disabled claim button. */
function Loading({ code }: { code: string }) {
  return (
    <div aria-label="Loading your invite" aria-busy="true" className="flex flex-1 flex-col">
      <Header code={code} />
      <div className="mt-6 flex items-center gap-3">
        <Skeleton className="size-12 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-3/5 rounded-lg" />
          <Skeleton className="h-3.5 w-4/5 rounded-lg" />
        </div>
      </div>
      <Card className="mt-4 overflow-hidden">
        <Skeleton className="h-40 rounded-none" />
        <div className="flex flex-col gap-3 p-5">
          <Skeleton className="h-7 w-2/3 rounded-lg" />
          <Skeleton className="h-3.5 w-1/2 rounded-lg" />
          <Skeleton className="h-3.5 w-2/5 rounded-lg" />
        </div>
      </Card>
      <Footer>
        <Button size="cta" block disabled>
          Claim your spot
        </Button>
        <span className="text-center text-xs font-medium text-muted-ink">Nothing is charged in the app. You pay the host on the day.</span>
      </Footer>
    </div>
  );
}

/** Offline, from the canvas: the dark bar, what we saved, the count as of then, and a claim button that waits for a connection. */
function Offline({ invite, savedAt, draft }: { invite: ResolvedInvite; savedAt: string; draft: Draft | null }) {
  const a = invite.activity;
  const at = new Date(savedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const width = a.capacity > 0 ? Math.round(((a.capacity - Math.max(0, a.spotsLeft)) / a.capacity) * 100) : 0;
  return (
    <>
      <div role="status" className="-mx-4 flex items-center gap-2.5 bg-[#2B2F36] px-5 py-3.5 text-sm font-medium text-white sm:-mx-6">
        <WifiOff className="size-[18px] shrink-0" />
        <span>You&apos;re offline. Showing what we saved at {at}.</span>
      </div>
      <div className="mt-6">
        <InviterRow invite={invite} />
      </div>
      <Card className="mt-4 flex flex-col gap-4 p-5">
        <h1 className="text-[28px] leading-[1.05] tracking-[-0.025em]">{a.title}</h1>
        <div className="flex flex-col gap-2 text-sm text-body">
          <span>{formatWhen(a.startsAt, a.timezone)} local time</span>
          <span>{a.location}</span>
          <span>
            <strong className="text-ink">{formatMoney(a.price)}</strong> per spot
          </span>
        </div>
        <div className="flex flex-col gap-2.5 border-t border-[#EEF0F2] pt-3.5">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2.5 text-[15px] font-bold text-muted-ink">
              <span className="size-2 rounded-full bg-[#9AA1AA]" /> {a.spotsLeft} of {a.capacity} left at {at}
            </span>
            <span className="text-xs font-bold uppercase tracking-[0.06em] text-muted-ink">Not live</span>
          </div>
          <span className="block h-1 overflow-hidden rounded-sm bg-line">
            <span className="block h-1 bg-[#9AA1AA]" style={{ width: `${width}%` }} />
          </span>
        </div>
      </Card>
      {draft?.name && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl bg-brand-tint px-4 py-3.5 text-sm leading-relaxed text-brand-deep">
          <Check className="mt-0.5 size-4 shrink-0" />
          <span>Your name and number are saved. When you&apos;re back online, it&apos;s one tap to claim, and we&apos;ll check the spot is still there.</span>
        </div>
      )}
      <Footer>
        <Button size="cta" block disabled>
          Claim when you&apos;re back online
        </Button>
        <span className="text-center text-xs font-medium text-muted-ink">We need a connection to make sure the spot is still yours.</span>
      </Footer>
    </>
  );
}

function Header({ code }: { code: string }) {
  return (
    <div className="flex h-11 items-center justify-between">
      <Wordmark tone="brand" className="text-xl" />
      <span className="text-[13px] font-semibold text-muted-ink">Invite {code}</span>
    </div>
  );
}

/** The white bar pinned under the phone screens on the canvas, holding the main action. */
function Footer({ children }: { children: React.ReactNode }) {
  return <div className="sticky bottom-0 -mx-4 mt-auto flex flex-col gap-2.5 bg-surface px-4 pb-8 pt-3 shadow-[0_-1px_0_var(--line)] sm:mx-0 sm:px-5">{children}</div>;
}

function BackCircle({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="flex size-11 items-center justify-center rounded-full bg-surface text-ink shadow-[var(--shadow-card)]">
      <ChevronLeft className="size-5" />
    </button>
  );
}

function InviterRow({ invite }: { invite: ResolvedInvite }) {
  const name = invite.inviter.displayName;
  const headline = invite.isHostInvite ? (invite.rail === "vouch" ? `${name}, the host, vouched for you` : `${name}, the host, shared this with you`) : invite.rail === "vouch" ? `${name} vouched for you` : `${name} shared this with you`;
  const sub = invite.isHostInvite ? `${name} is running this and wants you there. You'll start your own group.` : invite.rail === "vouch" ? `${name} is going and saved this invite just for you.` : `${name} is going. Anyone with this link can join while spots last.`;
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

function Details({ invite, spotsLeft, idempotencyKey, onBack, onClaimed, onFull }: { invite: ResolvedInvite; spotsLeft: number; idempotencyKey: string; onBack: () => void; onClaimed: (r: ClaimResult) => void; onFull: () => void }) {
  const { userId, anonId } = useUser();
  const draft = useMemo(() => readJson<Draft>(draftKey(invite.code)), [invite.code]);
  const [name, setName] = useState(draft?.name ?? "");
  const [contact, setContact] = useState(draft?.contact ?? "");
  const [error, setError] = useState<{ code: ErrorCode; message: string } | null>(null);

  useEffect(() => {
    writeJson(draftKey(invite.code), { name, contact } satisfies Draft);
  }, [name, contact, invite.code]);
  const me = useQuery({ queryKey: ["me", userId], queryFn: () => api.me(userId!), enabled: !!userId, retry: false });
  const known = me.data?.user ?? null;
  const inviter = invite.inviter.displayName;

  useEffect(() => {
    track({ name: "claim_started", anonId, userId, inviteCode: invite.code });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const claim = useMutation({
    mutationFn: () => api.claim(invite.code, { idempotencyKey, displayName: known ? undefined : name, contact: contact || undefined, platform: "web", anonId }, known ? userId : null),
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
    <>
      <div className="flex h-14 items-center">
        <BackCircle onClick={onBack} label="Back to the invite" />
      </div>
      <div className="mt-2 flex flex-col gap-2">
        <h1 className="text-[28px] leading-[1.05] tracking-[-0.025em]">Almost there</h1>
        <p className="text-[15px] leading-relaxed text-body">
          {known
            ? `You're claiming as ${known.displayName}.${invite.rail === "vouch" && !known.hasContact ? ` Add the number or email ${inviter} used so we can match the vouch.` : ""}`
            : `Tell us who you are so ${inviter}${invite.isHostInvite ? "" : " and the host"} ${invite.isHostInvite ? "knows" : "know"} who's coming. This also sets up your Velio account, so your plans are here next time. No password.`}
        </p>
      </div>
      <Card radius={16} className="mt-4 flex items-center justify-between gap-3 px-4 py-3.5">
        <span className="flex flex-col">
          <span className="font-bold">{a.title}</span>
          <span className="text-sm text-body">{formatWhen(a.startsAt, a.timezone)}</span>
        </span>
        <span className="inline-flex items-center gap-2 text-sm font-bold text-scarcity-text">
          <Dot spotsLeft={spotsLeft} /> {spotsLeft} left
        </span>
      </Card>
      <form
        className="mt-6 flex flex-1 flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          track({ name: "claim_submitted", anonId, userId, inviteCode: invite.code });
          claim.mutate();
        }}
      >
        {!known && (
          <Field label="Your name" htmlFor="name" labelClass="text-sm font-semibold text-ink" error={error?.code === "VALIDATION" && !contactError ? error.message : undefined}>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" required maxLength={60} className={guestInputClass} />
          </Field>
        )}
        {(!known || invite.rail === "vouch") && (
          <Field
            label="Phone number or email"
            htmlFor="contact"
            labelClass="text-sm font-semibold text-ink"
            error={contactError ? (error.code === "INVITE_NOT_FOR_YOU" ? `This invite was sent to a different number or email. Check with ${inviter} which one they used.` : error.message) : undefined}
            hint={invite.rail === "vouch" ? `${inviter}'s vouch is tied to this, so use the same number or email they have for you. We only keep a scrambled version of it.` : "We'll use this to find your plans next time. We only keep a scrambled version of it."}
          >
            <input
              id="contact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder={invite.rail === "vouch" ? `The one ${inviter} sent this to` : "Phone number or email"}
              autoComplete="tel"
              required={!known || !known.hasContact}
              aria-invalid={!!contactError}
              className={guestInputClass}
            />
          </Field>
        )}
        {error && !contactError && (
          <div role="alert" className="rounded-xl bg-warning-bg px-3.5 py-3 text-sm font-semibold text-warning-text">
            {error.message}
          </div>
        )}
        <Footer>
          <Button type="submit" size="cta" block disabled={claim.isPending} aria-busy={claim.isPending}>
            {claim.isPending ? (
              <>
                <Spinner /> Claiming…
              </>
            ) : (
              "Claim my spot"
            )}
          </Button>
        </Footer>
      </form>
    </>
  );
}

/** A 24px rounded checkbox drawn like the canvas's, with the label as the hit area. */
function Choice({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} onClick={() => onChange(!checked)} className="flex min-h-[52px] w-full items-center gap-3.5 text-left text-sm font-semibold text-ink">
      <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-lg border-2", checked ? "border-brand bg-brand text-white" : "border-[#C9CDD3] bg-surface")}>{checked && <Check className="size-4" strokeWidth={3} />}</span>
      {children}
    </button>
  );
}

function YoureIn({ invite, result }: { invite: ResolvedInvite; result: ClaimResult }) {
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
    <>
      <div className="mt-8 flex flex-col gap-4">
        <span className="flex size-[72px] items-center justify-center rounded-full bg-brand text-white">
          <Check className="size-8" strokeWidth={2.5} />
        </span>
        <h1 className="text-[30px] leading-[1.05] tracking-[-0.025em]">{own ? "You're in. Your own group starts here" : `You're in ${result.plan.owner.displayName}'s plan`}</h1>
        <p className="text-[15px] text-body">
          {a.title}, {formatDay(a.startsAt, a.timezone)} at {formatTime(a.startsAt, a.timezone)}. Your spot is saved.
        </p>
      </div>
      <Card className="mt-6 flex flex-col px-4 py-1">
        {result.plan.members.map((m, i) => (
          <div key={m.userId} className={cn("flex items-center gap-3 py-3", i > 0 && "border-t border-[#EEF0F2]")}>
            <Avatar name={m.displayName} />
            <span className="flex-1 text-sm font-bold">
              {m.displayName}
              {m.userId === result.userId ? " (you)" : ""}
            </span>
            <span className={cn("text-[13px]", m.userId === result.userId ? "font-bold text-brand-deep" : "text-muted-ink")}>{describe(m)}</span>
          </div>
        ))}
      </Card>
      <div className="mt-4">
        <SpotsLine spotsLeft={a.spotsLeft} capacity={a.capacity} />
      </div>
      <Card radius={16} className="mt-4 flex flex-col px-4 py-0.5">
        <div role="group" aria-label="Messages from Velio" className="flex flex-col">
          <div className="border-b border-[#EEF0F2]">
            <Choice
              checked={remind}
              onChange={(v) => {
                setRemind(v);
                prefs.mutate({ remindDayBefore: v });
              }}
            >
              Remind me the day before
            </Choice>
          </div>
          <Choice
            checked={follow}
            onChange={(v) => {
              setFollow(v);
              prefs.mutate({ friendUpdates: v });
            }}
          >
            Tell me when {followName} plans something new
          </Choice>
        </div>
      </Card>
      <Footer>
        <span className="text-sm font-semibold text-body">Someone you&apos;d want there too? Spots are going.</span>
        {a.invitesEnabled ? (
          <ButtonLink href={`/activities/${a.id}#invite`} size="cta" block>
            Bring a friend
          </ButtonLink>
        ) : (
          <ButtonLink href={`/activities/${a.id}`} size="cta" block>
            See the activity
          </ButtonLink>
        )}
        <Button
          size="soft"
          variant={added ? "tint" : "outline"}
          block
          onClick={() => {
            downloadCalendar(a);
            setAdded(true);
          }}
        >
          <CalendarCheck className="size-4" /> {added ? "Added to calendar" : "Add to calendar"}
        </Button>
      </Footer>
    </>
  );
}

function FilledUp({ invite }: { invite: ResolvedInvite }) {
  const { userId, anonId } = useUser();
  const [watching, setWatching] = useState(false);
  const [told, setTold] = useState(false);
  const a = invite.activity;
  const name = invite.inviter.displayName;
  return (
    <>
      <Header code={invite.codeDisplay} />
      <div className="mt-6 flex items-center gap-3 text-sm text-body">
        <Avatar name={name} size={48} />
        <span>
          {name} wanted you on <strong className="text-ink">{a.title}</strong> on {formatDay(a.startsAt, a.timezone)}.
        </span>
      </div>
      <div className="mt-6 flex flex-col gap-2">
        <h1 className="text-[28px] leading-[1.05] tracking-[-0.025em]">This one filled up before you got here</h1>
        <p className="text-[15px] leading-relaxed text-body">Your invite is still good. If someone drops out, we&apos;ll tell you straight away and you can take their spot.</p>
      </div>
      <div className="mt-5">
        <SpotsLine spotsLeft={0} capacity={a.capacity} />
      </div>
      <Button
        size="cta"
        variant={watching ? "tint" : "outline"}
        block
        className="mt-5 shadow-none"
        onClick={() => {
          setWatching(true);
          api.watch(a.id, { anonId, platform: "web" }, userId).catch(() => undefined);
        }}
      >
        <Bell className="size-[18px]" /> {watching ? "We'll tell you if a spot opens" : "Tell me if a spot opens"}
      </Button>
      <div className="mt-7">
        <OtherDates hostId={a.host.id} excludeId={a.id} label="Same host, other dates" />
      </div>
      <Footer>
        <button
          type="button"
          onClick={() => {
            setTold(true);
            track({ name: "invite_missed", anonId, userId, inviteCode: invite.code, activityId: a.id });
          }}
          className={cn("inline-flex min-h-12 items-center justify-center text-[15px] font-bold", told ? "text-muted-ink" : "text-brand")}
        >
          {told ? `${name} knows you missed it` : `Let ${name} know you missed it`}
        </button>
      </Footer>
    </>
  );
}
