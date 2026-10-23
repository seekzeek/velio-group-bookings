"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { Button, Card, CardSkeleton, Chip, Dot, ErrorState, TextLink } from "@/components/bits";
import { Cover } from "@/components/cover";
import { MobileInvites } from "@/components/mobile/invites";
import { PageShell } from "@/components/page-shell";
import { api, type Activity, type Invite } from "@/lib/api";
import { isApiError } from "@/lib/errors";
import { track } from "@/lib/events";
import { formatRelative, formatWhen, spotsText } from "@/lib/format";
import { useUser } from "@/lib/user-context";
import { cn } from "@/lib/utils";

type Filter = "all" | "waiting" | "joined" | "missed";

const filterOf = (i: Invite): Exclude<Filter, "all"> | "other" =>
  i.status === "joined" ? "joined" : i.status === "not_opened" || i.status === "opened" ? "waiting" : i.status === "opened_when_full" || i.status === "expired" ? "missed" : "other";

function chip(i: Invite): { label: string; tone: "ok" | "warn" | "grey" | "dim" } {
  switch (i.status) {
    case "joined":
      return { label: `Joined ${i.joinedAt ? formatRelative(i.joinedAt) : ""}`.trim(), tone: "ok" };
    case "opened":
      return { label: "Opened, not claimed", tone: "warn" };
    case "opened_when_full":
      return { label: "Opened when it was full", tone: "warn" };
    case "not_opened":
      return { label: "Not opened yet", tone: "grey" };
    case "expired":
      return { label: i.opensCount > 0 ? "Expired" : "Expired, never opened", tone: "dim" };
    case "revoked":
      return { label: "Link turned off", tone: "dim" };
    case "active":
      return { label: `${i.opensCount} opened · ${i.joinedCount} joined`, tone: "grey" };
  }
}

function activityStatus(a: Activity) {
  if (a.status === "started") return `Happened ${formatRelative(a.startsAt)}`;
  return spotsText(a.spotsLeft, a.capacity, true);
}

/** My invites from the canvas: three tiles, filter pills, then one white section per activity with a row per invite. */
export default function InvitesPage() {
  const { userId, anonId, ready } = useUser();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [done, setDone] = useState<Record<string, string>>({});
  const invites = useQuery({ queryKey: ["my-invites", userId], queryFn: () => api.myInvites(userId!), enabled: ready && !!userId });

  const revoke = useMutation({
    mutationFn: (code: string) => api.revokeInvite(userId!, code),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["my-invites", userId] }),
  });

  async function reshare(i: Invite, kind: "invite_nudged" | "invite_link_copied") {
    try {
      await navigator.clipboard.writeText(i.url);
    } catch {
      window.prompt("Copy this link", i.url);
    }
    track({ name: kind, anonId, userId, inviteCode: i.code, activityId: i.activityId });
    setDone((d) => ({ ...d, [i.id]: kind === "invite_nudged" ? "Nudged" : "Copied" }));
  }

  const data = invites.data;
  const errorCode = invites.isError ? (isApiError(invites.error) ? invites.error.code : "TRY_AGAIN") : null;
  const mobile = (
    <div className="sm:hidden">
      <MobileInvites data={data} pending={!!userId && invites.isPending} error={errorCode} onRetry={() => invites.refetch()} signedIn={!!userId} filter={filter} setFilter={setFilter} filterOf={filterOf} done={done} reshare={reshare} revoke={(code) => revoke.mutate(code)} />
    </div>
  );

  if (ready && !userId) {
    return (
      <PageShell flush>
        {mobile}
        <Card className="hidden p-6 text-body sm:block">Pick who you are at the top of the page to see your invites.</Card>
      </PageShell>
    );
  }

  const all = data?.activities.flatMap((g) => g.invites) ?? [];
  const counts = { all: all.length, waiting: all.filter((i) => filterOf(i) === "waiting").length, joined: all.filter((i) => filterOf(i) === "joined").length, missed: all.filter((i) => filterOf(i) === "missed").length };
  const waiting = data?.activities.map((g) => ({ g, rows: g.invites.filter((i) => filterOf(i) === "waiting") })).find((x) => x.rows.length > 0 && x.g.activity.spotsLeft > 0);

  return (
    <PageShell flush>
      {mobile}
      <div className="hidden sm:block">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[32px] leading-[1.02] tracking-[-0.03em] sm:text-[40px]">My invites</h1>
        <span className="text-base text-body">Who you&apos;ve asked, who came, and who might still need a nudge.</span>
      </div>

      {invites.isPending && (
        <div className="mt-6">
          <CardSkeleton lines={3} />
        </div>
      )}
      {invites.isError && (
        <div className="mt-6">
          <ErrorState code={isApiError(invites.error) ? invites.error.code : "TRY_AGAIN"} />
        </div>
      )}

      {data && all.length === 0 && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card className="flex items-start gap-3.5 p-6">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand">
              <ShieldCheck className="size-5" />
            </span>
            <span className="flex flex-col gap-1">
              <span className="text-[17px] font-bold">No vouches yet</span>
              <span className="text-sm text-body">A personal invite for one friend, with your name on it. Send one from any activity you&apos;re going to.</span>
              <TextLink href="/plans">Open My plans</TextLink>
            </span>
          </Card>
          <Card className="flex items-start gap-3.5 p-6">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#EEF0F2] text-body">
              <Link2 className="size-5" />
            </span>
            <span className="flex flex-col gap-1">
              <span className="text-[17px] font-bold">No links shared yet</span>
              <span className="text-sm text-body">Anyone with the link can join your plan while spots last. Copy one from any activity you&apos;re going to.</span>
              <TextLink href="/explore">Find something to book</TextLink>
            </span>
          </Card>
        </div>
      )}

      {data && all.length > 0 && (
        <div className="mt-6 flex flex-col gap-5">
          <div className="flex flex-wrap gap-3">
            <Card radius={16} className="flex min-w-0 flex-[1_1_160px] flex-col gap-1 px-5 py-[18px]">
              <span className="text-xs font-bold uppercase tracking-[0.06em] text-muted-ink">Invites sent</span>
              <span className="text-[28px] font-bold leading-none tracking-tight">{data.summary.sent}</span>
              <span className="text-[13px] text-body">
                {data.summary.vouches} {data.summary.vouches === 1 ? "vouch" : "vouches"}, {data.summary.links} {data.summary.links === 1 ? "link" : "links"}
              </span>
            </Card>
            <Card radius={16} className="flex min-w-0 flex-[1_1_160px] flex-col gap-1 px-5 py-[18px]">
              <span className="text-xs font-bold uppercase tracking-[0.06em] text-muted-ink">Joined you</span>
              <span className="text-[28px] font-bold leading-none tracking-tight">{data.summary.joined}</span>
              <span className="text-[13px] text-body">{data.summary.joined === 0 ? "Nobody yet" : data.summary.joinedNew === data.summary.joined ? (data.summary.joined === 1 ? "New to Velio" : "All new to Velio") : `${data.summary.joinedNew} new to Velio`}</span>
            </Card>
            {waiting ? (
              <div className="flex min-w-0 flex-[2_1_320px] flex-wrap items-center justify-between gap-3 rounded-2xl bg-warning-bg px-5 py-[18px] text-warning-text">
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-base font-bold">
                    {waiting.rows.length} {waiting.rows.length === 1 ? "person" : "people"} could still make {waiting.g.activity.title}
                  </span>
                  <span className="text-[13px]">
                    {waiting.rows.map((i) => `${i.recipientLabel ?? "Someone"} ${i.status === "opened" ? "opened it and hasn't claimed" : "hasn't opened it"}`).join(". ")}. {waiting.g.activity.spotsLeft} spots left, first come first served.
                  </span>
                </span>
                <Button size="card" variant="warning" className="h-[42px] text-sm" onClick={() => waiting.rows.forEach((i) => reshare(i, "invite_nudged"))}>
                  Nudge {waiting.rows.length === 1 ? (waiting.rows[0]!.recipientLabel ?? "them") : "both"}
                </Button>
              </div>
            ) : (
              <Card radius={16} className="flex min-w-0 flex-[1_1_160px] flex-col gap-1 px-5 py-[18px]">
                <span className="text-xs font-bold uppercase tracking-[0.06em] text-muted-ink">Waiting</span>
                <span className="text-[28px] font-bold leading-none tracking-tight">{data.summary.waiting}</span>
                <span className="text-[13px] text-body">Sent and not yet claimed</span>
              </Card>
            )}
          </div>

          <div role="group" aria-label="Filter invites" className="flex gap-2 overflow-x-auto">
            {(["all", "waiting", "joined", "missed"] as Filter[]).map((f) => (
              <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={cn("h-[38px] shrink-0 rounded-full px-3.5 text-[13px] capitalize", filter === f ? "bg-ink font-bold text-white" : "bg-surface font-semibold text-ink shadow-[var(--shadow-card)]")}>
                {f} · {counts[f]}
              </button>
            ))}
          </div>

          {data.activities.map((g) => {
            const rows = g.invites.filter((i) => filter === "all" || filterOf(i) === filter);
            if (rows.length === 0) return null;
            const past = g.activity.status === "started";
            return (
              <Card key={g.activity.id} className={cn("flex flex-col gap-2 px-6 pb-2 pt-[18px]", past && "opacity-80")}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="size-14 shrink-0 overflow-hidden rounded-[14px]">
                      <Cover illustration={g.activity.illustration} photos={g.activity.photos} />
                    </span>
                    <div className="flex flex-col">
                      <Link href={`/activities/${g.activity.id}`} className="text-base font-bold">
                        {g.activity.title}
                      </Link>
                      <span className="text-[13px] text-body">
                        {formatWhen(g.activity.startsAt, g.activity.timezone)}
                        {g.viewerGroupSize > 1 ? ` · your group of ${g.viewerGroupSize}` : ""}
                      </span>
                    </div>
                  </div>
                  <span className={cn("inline-flex items-center gap-2 text-[13px] font-bold", past ? "text-muted-ink" : g.activity.spotsLeft <= 3 ? "text-scarcity-text" : "text-brand-deep")}>
                    <Dot spotsLeft={past ? -1 : g.activity.spotsLeft} /> {activityStatus(g.activity)}
                  </span>
                </div>
                <div className="flex flex-col">
                  {rows.map((i, idx) => {
                    const c = chip(i);
                    const label = i.recipientLabel ?? (i.rail === "public" ? "Share link" : "Vouch");
                    return (
                      <div key={i.id} className={cn("flex flex-wrap items-center gap-3 py-3", idx < rows.length - 1 && "border-b border-[#EEF0F2]")}>
                        <Avatar name={i.rail === "public" ? "#" : label} size={34} colour={i.rail === "public" ? "#3D424A" : undefined} />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="text-[15px] font-bold">{label}</span>
                          <span className="text-xs text-muted-ink">
                            {i.rail === "vouch" ? "Vouch" : "Public link"} · {i.rail === "vouch" ? "sent" : "shared"} {formatRelative(i.createdAt)}
                          </span>
                        </div>
                        <Chip tone={c.tone}>{c.label}</Chip>
                        <span className="min-w-[96px] text-right text-sm font-bold text-brand">
                          {done[i.id] ? (
                            <span className="text-muted-ink">{done[i.id]}</span>
                          ) : i.status === "opened" ? (
                            <button type="button" onClick={() => reshare(i, "invite_nudged")}>
                              Nudge
                            </button>
                          ) : i.status === "not_opened" ? (
                            <button type="button" onClick={() => reshare(i, "invite_link_copied")}>
                              Copy link again
                            </button>
                          ) : i.status === "active" ? (
                            <button type="button" onClick={() => revoke.mutate(i.code)}>
                              Turn off link
                            </button>
                          ) : i.status === "revoked" ? (
                            <Link href={`/activities/${i.activityId}#invite`}>Make a new link</Link>
                          ) : i.status === "opened_when_full" ? (
                            <Link href="/explore">Send another date</Link>
                          ) : null}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
          <span className="text-xs text-muted-ink">Names are the labels you gave when inviting. Only you can see them. Velio never shows anyone the number or email you used.</span>
        </div>
      )}
      </div>
    </PageShell>
  );
}
