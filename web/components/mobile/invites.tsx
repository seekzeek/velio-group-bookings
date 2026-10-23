"use client";

import { Link2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { ErrorState, Skeleton, TextButton } from "@/components/bits";
import type { Activity, Invite, MyInvites } from "@/lib/api";
import type { ErrorCode } from "@/lib/errors";
import { formatDay, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BottomBar, DotLine, H1, IconBox, Pill, PillRow, Screen } from "./bits";

type Filter = "all" | "waiting" | "joined" | "missed";

type Props = {
  data: MyInvites | undefined;
  pending: boolean;
  error: ErrorCode | null;
  onRetry: () => void;
  signedIn: boolean;
  filter: Filter;
  setFilter: (f: Filter) => void;
  filterOf: (i: Invite) => Filter | "other";
  done: Record<string, string>;
  reshare: (i: Invite, kind: "invite_nudged" | "invite_link_copied") => void;
  revoke: (code: string) => void;
};

function status(i: Invite): { label: string; className: string } {
  switch (i.status) {
    case "joined":
      return { label: `Joined${i.joinedAt ? ` ${formatRelative(i.joinedAt)}` : ""}`, className: "font-bold text-brand-deep" };
    case "opened":
      return { label: "Opened, not claimed", className: "font-bold text-warning-text" };
    case "opened_when_full":
      return { label: "Opened when it was full", className: "font-bold text-warning-text" };
    case "not_opened":
      return { label: "Not opened yet", className: "font-semibold text-body" };
    case "active":
      return { label: `${i.opensCount} opened · ${i.joinedCount} joined`, className: "font-semibold text-body" };
    case "expired":
      return { label: i.opensCount > 0 ? "Expired" : "Expired, never opened", className: "font-semibold text-muted-ink" };
    case "revoked":
      return { label: "Link turned off", className: "font-semibold text-muted-ink" };
  }
}

function activityLine(a: Activity) {
  if (a.status === "started") return "Past";
  return a.spotsLeft <= 0 ? "Full" : `${a.spotsLeft} left`;
}

/** My invites on a phone: three tiles, filter pills, a section per activity with one row per invite, and the note at the bottom. */
export function MobileInvites({ data, pending, error, onRetry, signedIn, filter, setFilter, filterOf, done, reshare, revoke }: Props) {
  const all = data?.activities.flatMap((g) => g.invites) ?? [];
  const counts = { all: all.length, waiting: all.filter((i) => filterOf(i) === "waiting").length, joined: all.filter((i) => filterOf(i) === "joined").length, missed: all.filter((i) => filterOf(i) === "missed").length };
  const empty = !signedIn || (data && all.length === 0);

  return (
    <Screen>
      <div className="flex h-11 items-center px-5 pt-5">
        <H1>My invites</H1>
      </div>
      {pending && signedIn && (
        <div className="flex flex-col gap-3 p-5">
          <Skeleton className="h-20 rounded-[20px]" />
          <Skeleton className="h-52 rounded-[20px]" />
        </div>
      )}
      {error && (
        <div className="p-5">
          <ErrorState code={error} action={<TextButton onClick={onRetry}>Try again</TextButton>} />
        </div>
      )}

      {empty && !pending && (
        <>
          <div className="flex flex-col gap-2 px-5 pt-6">
            <h2 className="text-[22px] leading-[1.1] tracking-[-0.02em]">Nothing sent yet</h2>
            <p className="text-[15px] leading-relaxed text-body">{signedIn ? "Invite from any activity you're going to. Two ways to do it:" : "Pick who you are at the top, then invite from any activity you're going to. Two ways to do it:"}</p>
          </div>
          <div className="flex flex-col gap-3 px-5 pt-5">
            <div className="flex items-start gap-3 rounded-[20px] bg-surface p-[18px] shadow-[var(--shadow-card)]">
              <IconBox>
                <ShieldCheck className="size-5" />
              </IconBox>
              <span className="flex flex-col gap-1">
                <span className="text-base font-bold">No vouches yet</span>
                <span className="text-sm leading-snug text-muted-ink">A personal invite for one friend, with your name on it.</span>
              </span>
            </div>
            <div className="flex items-start gap-3 rounded-[20px] bg-surface p-[18px] shadow-[var(--shadow-card)]">
              <IconBox tone="grey">
                <Link2 className="size-5" />
              </IconBox>
              <span className="flex flex-col gap-1">
                <span className="text-base font-bold">No links shared yet</span>
                <span className="text-sm leading-snug text-muted-ink">Anyone with the link can join your plan while spots last.</span>
              </span>
            </div>
          </div>
          <div className="h-6" />
          <BottomBar>
            <Link href="/plans" className="flex h-14 flex-1 items-center justify-center rounded-2xl bg-brand text-[17px] font-bold text-white shadow-[var(--shadow-cta)]">
              Open a plan to invite from
            </Link>
          </BottomBar>
        </>
      )}

      {data && all.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-2 px-5 pt-4">
            <Tile n={data.summary.sent} label="Sent" />
            <Tile n={data.summary.joined} label="Joined you" ok />
            <Tile n={data.summary.waiting} label="Waiting" />
          </div>
          <PillRow height={36}>
            {(["all", "waiting", "joined", "missed"] as Filter[]).map((f) => (
              <Pill key={f} height={36} pressed={filter === f} onClick={() => setFilter(f)}>
                {f[0]!.toUpperCase() + f.slice(1)} · {counts[f]}
              </Pill>
            ))}
          </PillRow>
          {data.activities.map((g) => {
            const rows = g.invites.filter((i) => filter === "all" || filterOf(i) === filter);
            if (rows.length === 0) return null;
            const past = g.activity.status === "started";
            return (
              <section key={g.activity.id} className="flex flex-col gap-2 px-5 pt-5">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className={cn("font-sans text-[15px] font-bold", past && "text-body")}>{g.activity.title}</h2>
                  {past || g.activity.spotsLeft <= 0 ? (
                    <span className="text-xs font-semibold text-muted-ink">
                      {formatDay(g.activity.startsAt, g.activity.timezone)} · {activityLine(g.activity)}
                    </span>
                  ) : (
                    <DotLine spotsLeft={g.activity.spotsLeft} text={`${formatDay(g.activity.startsAt, g.activity.timezone)} · ${activityLine(g.activity)}`} className="text-xs" />
                  )}
                </div>
                <div className="rounded-[14px] bg-surface px-4 py-0.5 text-sm shadow-[var(--shadow-card)]">
                  {rows.map((i, idx) => {
                    const s = status(i);
                    const label = i.recipientLabel ?? (i.rail === "public" ? "Share link" : "Vouch");
                    const action = done[i.id] ? (
                      <span className="text-[13px] font-semibold text-muted-ink">{done[i.id]}</span>
                    ) : i.status === "opened" ? (
                      <TextButton className="min-h-8 text-[13px]" onClick={() => reshare(i, "invite_nudged")}>
                        Nudge {label}
                      </TextButton>
                    ) : i.status === "opened_when_full" ? (
                      <Link href="/explore" className="inline-flex min-h-8 items-center text-[13px] font-bold text-brand">
                        Send {label} another date
                      </Link>
                    ) : i.status === "not_opened" ? (
                      <TextButton className="min-h-8 text-[13px]" onClick={() => reshare(i, "invite_link_copied")}>
                        Copy link again
                      </TextButton>
                    ) : i.status === "active" ? (
                      <TextButton className="min-h-8 text-[13px]" onClick={() => revoke(i.code)}>
                        Turn off link
                      </TextButton>
                    ) : i.status === "revoked" ? (
                      <Link href={`/activities/${i.activityId}`} className="inline-flex min-h-8 items-center text-[13px] font-bold text-brand">
                        Make a new link
                      </Link>
                    ) : null;
                    return (
                      <div key={i.id} className={cn("flex flex-col py-2.5", idx < rows.length - 1 && "border-b border-[#EEF0F2]")}>
                        <div className="flex items-center justify-between gap-3">
                          <span>
                            <strong>{label}</strong> · {i.rail === "vouch" ? "vouch" : "public"}
                          </span>
                          <span className={cn("whitespace-nowrap text-right", s.className)}>{s.label}</span>
                        </div>
                        {action && <div className="-mb-1">{action}</div>}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
          <div className="mx-5 mb-8 mt-auto rounded-[14px] bg-brand-tint px-4 py-3 text-[13px] leading-snug text-brand-deep">Names here are the labels you gave when inviting. Only you can see them.</div>
        </>
      )}
    </Screen>
  );
}

function Tile({ n, label, ok = false }: { n: number; label: string; ok?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[14px] bg-surface px-3.5 py-3 shadow-[var(--shadow-card)]">
      <span className={cn("text-2xl font-bold tracking-[-0.01em]", ok && "text-brand-deep")}>{n}</span>
      <span className="text-xs font-semibold text-muted-ink">{label}</span>
    </div>
  );
}
