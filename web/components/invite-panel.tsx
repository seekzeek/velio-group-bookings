"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { api, type Activity, type Invite } from "@/lib/api";
import { isApiError } from "@/lib/errors";
import { track } from "@/lib/events";
import { formatRelative } from "@/lib/format";
import { useUser } from "@/lib/user-context";
import { Field, SecondaryButton, inputClass } from "./bits";

function statusLabel(i: Invite) {
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

/** The vouch form and share link shown once someone has a spot. Public links are created on the first Copy or Share, so they measure intent. */
export function InvitePanel({ activity, hostMode = false }: { activity: Activity; hostMode?: boolean }) {
  const { userId, anonId } = useUser();
  const queryClient = useQueryClient();
  const [label, setLabel] = useState("");
  const [contact, setContact] = useState("");
  const [sent, setSent] = useState<Invite | null>(null);
  const [copied, setCopied] = useState<"link" | "vouch" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mine = useQuery({ queryKey: ["my-invites", userId, activity.id], queryFn: () => api.myInvites(userId!, activity.id), enabled: !!userId });
  const existingLink = mine.data?.activities[0]?.invites.find((i) => i.rail === "public" && i.status === "active") ?? null;

  const vouch = useMutation({
    mutationFn: () => api.createInvite(userId!, { rail: "vouch", activityId: activity.id, recipientContact: contact, recipientLabel: label || undefined, platform: "web" }),
    onSuccess: ({ invite }) => {
      setSent(invite);
      setError(null);
      setContact("");
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
    if (navigator.share) {
      await navigator.share({ title: activity.title, text: `Come to ${activity.title} with me`, url: invite.url }).catch(() => undefined);
    } else {
      await copy(invite.url, "link", invite.code);
    }
  }

  async function copyOrCreateLink() {
    const invite = existingLink ?? (await link.mutateAsync()).invite;
    await copy(invite.url, "link", invite.code);
  }

  if (!userId) return null;

  return (
    <div id="invite" className="flex flex-col gap-5">
      {sent ? (
        <div className="flex flex-col gap-4 rounded-2xl bg-brand-tint p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand-deep" />
            <div className="flex flex-col gap-1">
              <span className="font-bold text-brand-deep">Vouch sent{sent.recipientLabel ? ` to ${sent.recipientLabel}` : ""}</span>
              <span className="text-sm text-brand-deep">Only the number or email you entered can claim it, so send them the link however you like.</span>
            </div>
          </div>
          <Field label={`${sent.recipientLabel ?? "Their"} link · code ${sent.codeDisplay}`} htmlFor="vouchLink">
            <div className="flex gap-2">
              <input id="vouchLink" readOnly value={sent.url} className={inputClass} />
              <button type="button" onClick={() => copy(sent.url, "vouch", sent.code)} className="h-12 shrink-0 rounded-[14px] bg-brand px-4 text-sm font-bold text-white">
                {copied === "vouch" ? "Copied" : "Copy"}
              </button>
            </div>
          </Field>
          <div className="flex gap-2">
            <SecondaryButton onClick={() => share(sent)}>Share link</SecondaryButton>
            <SecondaryButton onClick={() => setSent(null)}>Vouch for someone else</SecondaryButton>
          </div>
        </div>
      ) : (
        <form
          className="flex flex-col gap-3 rounded-2xl border border-line p-4"
          onSubmit={(e) => {
            e.preventDefault();
            vouch.mutate();
          }}
        >
          <span className="font-bold text-ink">
            Vouch for {hostMode ? "someone" : "a friend"} <span className="font-semibold text-muted-ink">· only they can claim it</span>
          </span>
          {hostMode && <span className="text-sm text-body">A personal invite with your name on it. They start their own group.</span>}
          <Field label="Who it's for" hint="Only you see this" htmlFor="vouchName">
            <input id="vouchName" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} placeholder="Tunde" className={inputClass} />
          </Field>
          <Field label="Their phone number or email" htmlFor="vouchTo" error={error ?? undefined}>
            <div className="flex gap-2">
              <input id="vouchTo" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Phone number or email" autoComplete="off" className={inputClass} aria-invalid={!!error} />
              <button type="submit" disabled={vouch.isPending || !contact} className="h-12 shrink-0 rounded-[14px] bg-brand px-4 text-sm font-bold text-white disabled:bg-[#DADDE1] disabled:text-muted-ink">
                {vouch.isPending ? "Sending" : "Send"}
              </button>
            </div>
          </Field>
        </form>
      )}

      <div className="flex flex-col gap-2">
        <span className="font-bold text-ink">
          Or share a link <span className="font-semibold text-muted-ink">· anyone with it can join</span>
        </span>
        <div className="flex gap-2">
          <input readOnly value={existingLink?.url ?? "Copy to create your link"} aria-label="Share link" className={inputClass} />
          <button type="button" onClick={copyOrCreateLink} disabled={link.isPending} className="h-12 shrink-0 rounded-[14px] border border-[#C9CDD3] bg-surface px-4 text-sm font-bold text-ink">
            {copied === "link" ? "Copied" : existingLink ? "Copy" : "Copy link"}
          </button>
        </div>
        {existingLink && (
          <button type="button" onClick={() => share(existingLink)} className="self-start text-sm font-bold text-brand">
            Share link
          </button>
        )}
      </div>

      {mine.data && mine.data.activities[0] && mine.data.activities[0].invites.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-ink">Sent so far</span>
            <Link href="/invites" className="text-sm font-bold text-brand">
              All my invites
            </Link>
          </div>
          {mine.data.activities[0].invites.map((i) => (
            <div key={i.id} className="flex items-center justify-between text-sm">
              <span>
                <strong>{i.recipientLabel ?? (i.rail === "public" ? "Share link" : "Vouch")}</strong> · {i.rail === "vouch" ? "vouch" : "public"}
              </span>
              <span className="text-muted-ink">{statusLabel(i)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
