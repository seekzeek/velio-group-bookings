"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { api, type Activity, type Invite } from "@/lib/api";
import { isApiError } from "@/lib/errors";
import { track } from "@/lib/events";
import { formatRelative } from "@/lib/format";
import { useUser } from "@/lib/user-context";
import { Button, TextLink, inputClass } from "./bits";

export function inviteStatusLabel(i: Invite) {
  switch (i.status) {
    case "joined":
      return `Joined ${i.joinedAt ? formatRelative(i.joinedAt) : ""}`.trim();
    case "opened":
      return "Opened, not claimed";
    case "opened_when_full":
      return "Opened when it was full";
    case "not_opened":
      return "Not opened yet";
    case "expired":
      return "Expired";
    case "revoked":
      return "Link turned off";
    case "active":
      return `${i.opensCount} opened · ${i.joinedCount} joined`;
  }
}

/** Everything the invite tools do, shared by the wide panel and the phone sheet so both talk to the API the same way. */
export function useInviteTools(activity: Activity) {
  const { userId, anonId } = useUser();
  const queryClient = useQueryClient();
  const [label, setLabel] = useState("");
  const [contact, setContact] = useState("");
  const [sent, setSent] = useState<Invite | null>(null);
  const [copied, setCopied] = useState<"link" | "vouch" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mine = useQuery({ queryKey: ["my-invites", userId, activity.id], queryFn: () => api.myInvites(userId!, activity.id), enabled: !!userId });
  const sentSoFar = mine.data?.activities[0]?.invites ?? [];
  const existingLink = sentSoFar.find((i) => i.rail === "public" && i.status === "active") ?? null;

  const vouch = useMutation({
    mutationFn: () => api.createInvite(userId!, { rail: "vouch", activityId: activity.id, recipientContact: contact, recipientLabel: label || undefined, platform: "web" }),
    onSuccess: ({ invite }) => {
      setSent(invite);
      setError(null);
      setContact("");
      setLabel("");
      void queryClient.invalidateQueries({ queryKey: ["my-invites", userId] });
    },
    onError: (err) => {
      if (isApiError(err, "VALIDATION")) setError("Enter a phone number or email.");
      else if (isApiError(err, "VOUCH_LIMIT")) setError("You've vouched for 10 people on this one. Share the link instead.");
      else if (isApiError(err)) setError(err.message);
      else setError("Something went wrong. Try again.");
    },
  });

  const link = useMutation({
    mutationFn: () => api.createInvite(userId!, { rail: "public", activityId: activity.id, platform: "web" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["my-invites", userId] }),
  });

  async function copy(text: string, kind: "link" | "vouch", code: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt("Copy this link", text);
    }
    setCopied(kind);
    track({ name: "invite_link_copied", anonId, userId, activityId: activity.id, inviteCode: code });
    setTimeout(() => setCopied(null), 2000);
  }

  async function share(invite: Invite) {
    track({ name: "invite_link_shared", anonId, userId, activityId: activity.id, inviteCode: invite.code });
    if (navigator.share) await navigator.share({ title: activity.title, text: `Come to ${activity.title} with me`, url: invite.url }).catch(() => undefined);
    else await copy(invite.url, "link", invite.code);
  }

  async function copyOrCreateLink() {
    const invite = existingLink ?? (await link.mutateAsync()).invite;
    await copy(invite.url, "link", invite.code);
  }

  async function shareOrCreateLink() {
    const invite = existingLink ?? (await link.mutateAsync()).invite;
    await share(invite);
  }

  return { userId, label, setLabel, contact, setContact, sent, setSent, copied, error, vouch, link, sentSoFar, existingLink, copy, share, copyOrCreateLink, shareOrCreateLink };
}

/** The booked state's invite tools on the wide page: vouch for a friend, or share a link, then "sent so far". */
export function InvitePanel({ activity }: { activity: Activity }) {
  const t = useInviteTools(activity);
  if (!t.userId) return null;

  return (
    <div id="invite" className="flex flex-col gap-[18px]">
      {t.sent ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-[#F7F8F7] p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-white">
              <ShieldCheck className="size-5" />
            </span>
            <div className="flex flex-col gap-1">
              <span className="text-base font-bold text-ink">Vouch sent{t.sent.recipientLabel ? ` to ${t.sent.recipientLabel}` : ""}</span>
              <span className="text-sm text-body">Only the number or email you entered can claim it, so send them the link however you like.</span>
            </div>
          </div>
          <label htmlFor="vouchLink" className="text-xs font-bold uppercase tracking-[0.06em] text-muted-ink">
            {t.sent.recipientLabel ?? "Their"} link · code {t.sent.codeDisplay}
          </label>
          <div className="flex gap-2">
            <input id="vouchLink" readOnly value={t.sent.url} className={inputClass} />
            <Button size="field" variant="outline" onClick={() => t.copy(t.sent!.url, "vouch", t.sent!.code)} className="px-3.5 text-sm">
              {t.copied === "vouch" ? "Copied" : "Copy"}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button size="row" className="flex-1" onClick={() => t.share(t.sent!)}>
              Share link
            </Button>
            <Button size="row" variant="outline" className="flex-1" onClick={() => t.setSent(null)}>
              Vouch for someone else
            </Button>
          </div>
        </div>
      ) : (
        <form
          className="flex flex-col gap-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            t.vouch.mutate();
          }}
        >
          <span className="text-[13px] font-bold text-ink">
            Vouch for a friend <span className="font-semibold text-muted-ink">· only they can claim it</span>
          </span>
          <label htmlFor="vouchName" className="sr-only">
            Who it&apos;s for
          </label>
          <input id="vouchName" value={t.label} onChange={(e) => t.setLabel(e.target.value)} maxLength={40} placeholder="Who's it for? Only you see this" className={inputClass} />
          <label htmlFor="vouchTo" className="sr-only">
            Their phone number or email
          </label>
          <div className="flex gap-2">
            <input id="vouchTo" value={t.contact} onChange={(e) => t.setContact(e.target.value)} placeholder="Phone number or email" autoComplete="off" className={inputClass} aria-invalid={!!t.error} />
            <Button type="submit" size="field" disabled={t.vouch.isPending || !t.contact}>
              {t.vouch.isPending ? "Sending" : "Send"}
            </Button>
          </div>
          {t.error && (
            <span role="alert" className="text-[13px] font-semibold text-scarcity-text">
              {t.error}
            </span>
          )}
        </form>
      )}

      <div className="flex flex-col gap-2.5">
        <label htmlFor="shareLink" className="text-[13px] font-bold text-ink">
          Or share a link <span className="font-semibold text-muted-ink">· anyone with it can join</span>
        </label>
        <div className="flex gap-2">
          <input id="shareLink" readOnly value={t.existingLink?.url ?? ""} placeholder="Copy to create your link" aria-label="Share link" className={`${inputClass} bg-[#F7F8F7]`} />
          <Button size="field" variant="outline" onClick={t.copyOrCreateLink} disabled={t.link.isPending}>
            {t.copied === "link" ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>

      {t.sentSoFar.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-[#EEF0F2] pt-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.06em] text-muted-ink">Sent so far</span>
            <TextLink href="/invites" className="min-h-0 text-[13px]">
              All my invites
            </TextLink>
          </div>
          {t.sentSoFar.map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-3 text-sm">
              <span>
                <strong>{i.recipientLabel ?? (i.rail === "public" ? "Share link" : "Vouch")}</strong> · {i.rail === "vouch" ? "vouch" : "public"}
              </span>
              <span className="whitespace-nowrap text-muted-ink">{inviteStatusLabel(i)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
