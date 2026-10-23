"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { UserPicker } from "./user-picker";

const links = [
  { href: "/explore", match: ["/explore", "/activities"], short: "Explore", full: "Explore" },
  { href: "/plans", match: ["/plans"], short: "Plans", full: "My plans" },
  { href: "/invites", match: ["/invites"], short: "Invites", full: "My invites" },
];

/**
 * The web chrome from the canvas. Wide: wordmark, three links, "Have an invite code?", the picker, "Host an activity".
 * Under 640px the canvas switches to the phone chrome: a 20px wordmark and four short links including Host, over the phone screens.
 * The picker stays on both, shrunk to an initial on the phone, because nothing else lets a visitor choose who they are.
 */
export function PageShell({ children, dark = false, width = 1180, flush = false }: { children: React.ReactNode; dark?: boolean; width?: 1180 | 760; flush?: boolean }) {
  const pathname = usePathname();
  const current = (match: string[]) => match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
  const hostPage = pathname.startsWith("/host");
  const container = width === 1180 ? "max-w-[1180px]" : "max-w-[760px]";

  return (
    <div className="min-h-dvh bg-ground">
      <header className={cn("sticky top-0 z-20", dark ? "bg-ink text-white" : "bg-surface shadow-[0_1px_0_var(--line)]")}>
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-2 py-2 pl-4 pr-3 sm:gap-3 sm:px-6 sm:py-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-6">
            <Link href="/explore" className={cn("font-heading text-xl font-bold tracking-[-0.02em] sm:text-[22px]", dark ? "text-white" : "text-ink")}>
              velio
            </Link>
            {dark ? (
              <span className="text-sm font-semibold text-[#C5CAD1]">Admin</span>
            ) : (
              <nav aria-label="Main" className="flex items-center gap-0.5 text-sm font-semibold sm:gap-1 sm:text-[15px]">
                {links.map((item) => {
                  const active = current(item.match);
                  return (
                    <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("inline-flex h-9 items-center whitespace-nowrap rounded-[10px] px-2 sm:h-10 sm:px-3", active ? "bg-ground text-ink" : "text-muted-ink")}>
                      <span className="sm:hidden">{item.short}</span>
                      <span className="hidden sm:inline">{item.full}</span>
                    </Link>
                  );
                })}
                <Link href="/host" aria-current={hostPage ? "page" : undefined} className={cn("inline-flex h-9 items-center rounded-[10px] px-2 sm:hidden", hostPage ? "bg-ground text-ink" : "text-muted-ink")}>
                  Host
                </Link>
              </nav>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3 sm:gap-4">
            {!dark && (
              <Link href="/i" className="hidden min-h-10 items-center text-sm font-bold text-brand lg:inline-flex">
                Have an invite code?
              </Link>
            )}
            <span className="sm:hidden">
              <UserPicker dark={dark} compact />
            </span>
            <span className="hidden sm:inline-flex">
              <UserPicker dark={dark} />
            </span>
            {!dark && (
              <Link href="/host/new" className="hidden h-10 items-center rounded-[10px] bg-brand px-4 text-sm font-bold text-white sm:inline-flex">
                Host an activity
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className={cn("mx-auto sm:px-6 sm:pb-16 sm:pt-8", flush ? "px-0 pb-0 pt-0" : "px-4 pb-16 pt-6", container)}>{children}</main>
    </div>
  );
}

/** The "‹ Explore" style breadcrumb above a page title. */
export function Crumb({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex min-h-10 items-center gap-1.5 self-start text-sm font-bold text-brand", className)}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {children}
    </Link>
  );
}
