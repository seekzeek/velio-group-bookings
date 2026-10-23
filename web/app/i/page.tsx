"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Dot, Skeleton } from "@/components/bits";
import { PageShell } from "@/components/page-shell";
import { api } from "@/lib/api";
import { normalizeCode } from "@/lib/codes";
import { isApiError } from "@/lib/errors";
import { formatDay } from "@/lib/format";
import { useUser } from "@/lib/user-context";
import { cn } from "@/lib/utils";

/** "Got an invite code?" The phone screen from the canvas, shown in a phone-width column on the web. */
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
    <PageShell width={760}>
      <div className="mx-auto flex min-h-[70dvh] max-w-[390px] flex-col gap-8 pt-2">
        <div className="flex flex-col gap-2">
          <h1 className="text-[30px] leading-[1.05] tracking-[-0.025em]">Got an invite code?</h1>
          <p className="text-[15px] leading-relaxed text-body">Every code is for a specific activity. Type the 8 characters your friend sent you. Capitals and dashes don&apos;t matter.</p>
        </div>
        <form
          className="flex flex-1 flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (canOpen && code) router.push(`/i/${code}`);
          }}
        >
          <label htmlFor="code" className="text-sm font-semibold text-ink">
            Invite code
          </label>
          <input
            id="code"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="AX7K-29QM"
            aria-invalid={!!expired || notFound}
            className={cn("h-[60px] w-full rounded-xl border-[1.5px] bg-surface px-4 text-[22px] font-bold tracking-[0.12em] text-ink outline-none placeholder:text-line", expired || notFound ? "border-scarcity-text" : "border-brand")}
          />
          {preview.isFetching && <Skeleton className="mt-1 h-3.5 w-56" />}
          {invite && !expired && (
            <span className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-brand-deep">
              <Dot spotsLeft={5} />
              {invite.activity.title} · {formatDay(invite.activity.startsAt, invite.activity.timezone)} · from {invite.inviter.displayName}
            </span>
          )}
          {expired && invite && (
            <div role="alert" className="mt-1.5 flex flex-col gap-1.5 rounded-xl bg-warning-bg px-3.5 py-3 text-warning-text">
              <span className="text-sm font-bold">This invite has expired</span>
              <span className="text-sm">
                It was for {invite.activity.title} on {formatDay(invite.activity.startsAt, invite.activity.timezone)}, which has already happened.
              </span>
              <a href="/explore" className="inline-flex min-h-8 items-center text-sm font-bold">
                See what&apos;s coming up
              </a>
            </div>
          )}
          {notFound && (
            <div role="alert" className="mt-1.5 flex flex-col gap-1.5 rounded-xl bg-warning-bg px-3.5 py-3 text-warning-text">
              <span className="text-sm font-bold">We can&apos;t find that code</span>
              <span className="text-sm">Check it with whoever sent it. Capitals and dashes don&apos;t matter.</span>
            </div>
          )}
          <div className="mt-auto pt-6">
            <Button type="submit" size="cta" block disabled={!canOpen}>
              Open invite
            </Button>
          </div>
        </form>
      </div>
    </PageShell>
  );
}
