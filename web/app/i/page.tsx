"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Cta, Field, inputClass } from "@/components/bits";
import { PageShell } from "@/components/page-shell";
import { api } from "@/lib/api";
import { isApiError } from "@/lib/errors";
import { formatDay } from "@/lib/format";
import { normalizeCode } from "@/lib/codes";
import { useUser } from "@/lib/user-context";

export default function EnterCodePage() {
  const [raw, setRaw] = useState("");
  const [debounced, setDebounced] = useState<string | null>(null);
  const { userId } = useUser();
  const router = useRouter();
  const code = normalizeCode(raw);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(code), 300);
    return () => clearTimeout(t);
  }, [code]);

  const preview = useQuery({ queryKey: ["invite", debounced, userId], queryFn: () => api.invite(debounced!, userId), enabled: !!debounced, retry: false });
  const invite = preview.data;
  const expired = invite && (invite.status === "expired" || invite.status === "started");
  const notFound = preview.isError && isApiError(preview.error, "INVITE_NOT_FOUND");
  const canOpen = !!invite && !expired;

  return (
    <PageShell>
      <div className="mx-auto flex max-w-md flex-col gap-8 pt-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl">Got an invite code?</h1>
          <p className="text-body">Every code is for a specific activity. Type the 8 characters your friend sent you. Capitals and dashes don&apos;t matter.</p>
        </div>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canOpen && code) router.push(`/i/${code}`);
          }}
        >
          <Field label="Invite code" htmlFor="code">
            <input
              id="code"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              placeholder="AX7K-29QM"
              aria-invalid={!!expired || notFound}
              className={`${inputClass} h-14 text-center font-heading text-2xl font-bold tracking-[0.2em]`}
            />
          </Field>
          {invite && !expired && (
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-deep">
              <span className="size-2 rounded-full bg-brand" />
              {invite.activity.title} · {formatDay(invite.activity.startsAt, invite.activity.timezone)} · from {invite.inviter.displayName}
            </span>
          )}
          {expired && invite && (
            <div role="alert" className="flex flex-col gap-1 rounded-2xl bg-warning-bg p-4 text-warning-text">
              <span className="font-bold">This invite has expired</span>
              <span className="text-sm">
                It was for {invite.activity.title} on {formatDay(invite.activity.startsAt, invite.activity.timezone)}, which has already happened.
              </span>
              <a href="/explore" className="mt-1 text-sm font-bold">
                See what&apos;s coming up
              </a>
            </div>
          )}
          {notFound && (
            <div role="alert" className="flex flex-col gap-1 rounded-2xl bg-warning-bg p-4 text-warning-text">
              <span className="font-bold">We can&apos;t find that code</span>
              <span className="text-sm">Check it with whoever sent it. Capitals and dashes don&apos;t matter.</span>
            </div>
          )}
          <Cta type="submit" disabled={!canOpen}>
            Open invite
          </Cta>
        </form>
      </div>
    </PageShell>
  );
}
