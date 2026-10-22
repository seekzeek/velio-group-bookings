"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { Card, CardSkeleton, Chip, EmptyState, ErrorState } from "@/components/bits";
import { Cover } from "@/components/cover";
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
    setDone((d) => ({ ...d, [i.id]: kind === "invite_nudged" ? "Nudged · link copied" : "Copied" }));
  }

  if (ready && !userId) {
    return (
      <PageShell>
        <EmptyState title="Pick who you are first" body="Choose a user at the top of the page to see their invites." />
      </PageShell>
    );
  }

  const data = invites.data;
  const all = data?.activities.flatMap((g) => g.invites) ?? [];
  const counts = { all: all.length, waiting: all.filter((i) => filterOf(i) === "waiting").length, joined: all.filter((i) => filterOf(i) === "joined").length, missed: all.filter((i) => filterOf(i) === "missed").length };
  const waiting = data?.activities.map((g) => ({ g, rows: g.invites.filter((i) => filterOf(i) === "waiting") })).find((x) => x.rows.length > 0 && x.g.activity.spotsLeft > 0);

  return (
    <PageShell>
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl sm:text-4xl">My invites</h1>
        <span className="text-body">Who you&apos;ve asked, who came, and who might still need a nudge.</span>
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
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <EmptyState title="No vouches yet" body="A personal invite for one friend, with your name on it. Send one from any activity you're going to.">
            <Link href="/plans" className="text-sm font-bold text-brand">
              Open My plans
            </Link>
          </EmptyState>
          <EmptyState title="No links shared yet" body="Anyone with the link can join your plan while spots last. Copy one from any activity you're going to.">
            <Link href="/explore" className="text-sm font-bold text-brand">
              Find something to book
            </Link>
          </EmptyState>
        </div>
      )}

      {data && all.length > 0 && (
        <div className="mt-6 flex flex-col gap-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="flex flex-col gap-1 p-5">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-ink">Invites sent</span>
              <span className="font-heading text-4xl font-bold">{data.summary.sent}</span>
              <span className="text-sm text-body">
                {data.summary.vouches} {data.summary.vouches === 1 ? "vouch" : "vouches"}, {data.summary.links} {data.summary.links === 1 ? "link" : "links"}
              </span>
            </Card>
            <Card className="flex flex-col gap-1 p-5">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-ink">Joined you</span>
              <span className="font-heading text-4xl font-bold">{data.summary.joined}</span>
              <span className="text-sm text-body">{data.summary.joined === 0 ? "Nobody yet" : data.summary.joinedNew === data.summary.joined ? (data.summary.joined === 1 ? "New to Velio" : "All new to Velio") : `${data.summary.joinedNew} new to Velio`}</span>
            </Card>
            {waiting ? (
              <Card className="flex flex-col gap-2 bg-warning-bg p-5 text-warning-text">
                <span className="font-bold">
                  {waiting.rows.length} {waiting.rows.length === 1 ? "person" : "people"} could still make {waiting.g.activity.title}
                </span>
                <span className="text-sm">
                  {waiting.rows.map((i) => `${i.recipientLabel ?? "Someone"} ${i.status === "opened" ? "opened it and hasn't claimed" : "hasn't opened it"}`).join(". ")}. {waiting.g.activity.spotsLeft} spots left, first come first served.
                </span>
                <button onClick={() => waiting.rows.forEach((i) => reshare(i, "invite_nudged"))} className="mt-1 h-10 self-start rounded-xl bg-warning-text px-4 text-sm font-bold text-white">
                  Nudge {waiting.rows.length === 1 ? waiting.rows[0]!.recipientLabel ?? "them" : "both"}
                </button>
              </Card>
            ) : (
              <Card className="flex flex-col gap-1 p-5">
                <span className="text-xs font-bold uppercase tracking-wide text-muted-ink">Waiting</span>
                <span className="font-heading text-4xl font-bold">{data.summary.waiting}</span>
                <span className="text-sm text-body">Sent and not yet claimed</span>
              </Card>
            )}
          </div>

          <div role="group" aria-label="Filter invites" className="flex gap-2 overflow-x-auto">
            {(["all", "waiting", "joined", "missed"] as Filter[]).map((f) => (
              <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)} className={cn("h-10 shrink-0 rounded-full border px-4 text-sm font-semibold capitalize", filter === f ? "border-ink bg-ink text-white" : "border-line bg-surface text-body")}>
                {f} · {counts[f]}
              </button>
            ))}
          </div>

          {data.activities.map((g) => {
            const rows = g.invites.filter((i) => filter === "all" || filterOf(i) === filter);
            if (rows.length === 0) return null;
            const past = g.activity.status === "started";
            return (
              <Card key={g.activity.id} className={cn("overflow-hidden", past && "opacity-80")}>
                <div className="flex items-center justify-between gap-3 border-b border-line p-4">
                  <div className="flex items-center gap-3">
                    <span className="size-14 shrink-0 overflow-hidden rounded-xl">
                      <Cover illustration={g.activity.illustration} photos={g.activity.photos} />
                    </span>
                    <div className="flex flex-col">
                      <Link href={`/activities/${g.activity.id}`} className="font-bold">
                        {g.activity.title}
                      </Link>
                      <span className="text-sm text-body">
                        {formatWhen(g.activity.startsAt, g.activity.timezone)}
                        {g.viewerGroupSize > 1 ? ` · your group of ${g.viewerGroupSize}` : ""}
                      </span>
                    </div>
                  </div>
                  <span className={cn("text-sm font-bold", past ? "text-muted-ink" : g.activity.spotsLeft <= 3 ? "text-scarcity-text" : "text-brand-deep")}>{activityStatus(g.activity)}</span>
                </div>
                <div className="divide-y divide-line">
                  {rows.map((i) => {
                    const c = chip(i);
                    const label = i.recipientLabel ?? (i.rail === "public" ? "Share link" : "Vouch");
                    return (
                      <div key={i.id} className="grid items-center gap-3 px-4 py-3 sm:grid-cols-[auto_1fr_auto_auto]">
                        <Avatar name={i.rail === "public" ? "#" : label} size={32} colour={i.rail === "public" ? "#3D424A" : undefined} />
                        <div className="flex flex-col">
                          <span className="font-bold">{label}</span>
                          <span className="text-xs text-muted-ink">
                            {i.rail === "vouch" ? "Vouch" : "Public link"} · {i.rail === "vouch" ? "sent" : "shared"} {formatRelative(i.createdAt)}
                          </span>
                        </div>
                        <Chip tone={c.tone}>{c.label}</Chip>
                        <span className="text-sm font-bold text-brand">
                          {done[i.id] ? (
                            <span className="text-muted-ink">{done[i.id]}</span>
                          ) : i.status === "opened" ? (
                            <button onClick={() => reshare(i, "invite_nudged")}>Nudge</button>
                          ) : i.status === "not_opened" ? (
                            <button onClick={() => reshare(i, "invite_link_copied")}>Copy link again</button>
                          ) : i.status === "active" ? (
                            <button onClick={() => revoke.mutate(i.code)}>Turn off link</button>
                          ) : i.status === "revoked" ? (
                            <Link href={`/activities/${i.activityId}#invite`}>Make a new link</Link>
                          ) : i.status === "opened_when_full" ? (
                            <Link href={`/explore`}>Send another date</Link>
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
    </PageShell>
  );
}
