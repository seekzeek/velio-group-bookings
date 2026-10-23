"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { UserPicker } from "./user-picker";

const links = [
  { href: "/explore", label: "Explore", short: "Explore", match: ["/explore", "/activities"] },
  { href: "/plans", label: "My plans", short: "Plans", match: ["/plans", "/host"] },
  { href: "/invites", label: "My invites", short: "Invites", match: ["/invites"] },
];

/**
 * The web chrome from the canvas. Desktop: wordmark, three links, "Have an invite code?", the picker, "Host an activity".
 * Phone width: wordmark and four short links including Host. The picker stays on both so a visitor can choose who they are.
 */
export function PageShell({ children, dark = false, width = 1180 }: { children: React.ReactNode; dark?: boolean; width?: 1180 | 760 }) {
  const pathname = usePathname();
  const current = (match: string[]) => match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
  const hostPage = pathname.startsWith("/host");
  const container = width === 1180 ? "max-w-[1180px]" : "max-w-[760px]";

  return (
    <div className={cn("min-h-dvh", dark ? "bg-ground" : "bg-ground")}>
      <header className={cn("relative z-10", dark ? "bg-ink text-white" : "bg-surface shadow-[0_1px_0_var(--line)]")}>
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-3 px-4 py-2 sm:px-6 sm:py-3">
          <div className="flex items-center gap-2 sm:gap-6">
            <Link href="/explore" className={cn("font-heading text-xl font-bold tracking-tight sm:text-[22px]", dark ? "text-white" : "text-ink")}>
              velio
            </Link>
            {dark ? (
              <span className="text-sm font-semibold text-[#C5CAD1]">Admin</span>
            ) : (
              <nav aria-label="Main" className="flex items-center gap-0.5 text-sm font-semibold sm:gap-1 sm:text-[15px]">
                {links.map((item) => {
                  const active = current(item.match) && !(item.href === "/plans" && hostPage && false);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn("inline-flex h-9 items-center whitespace-nowrap rounded-[10px] px-2 sm:h-10 sm:px-3", active ? "bg-ground text-ink" : "text-muted-ink")}
                    >
                      <span className="sm:hidden">{item.short}</span>
                      <span className="hidden sm:inline">{item.label}</span>
                    </Link>
                  );
                })}
                <Link href="/host" aria-current={hostPage ? "page" : undefined} className={cn("inline-flex h-9 items-center rounded-[10px] px-2 sm:hidden", hostPage ? "bg-ground text-ink" : "text-muted-ink")}>
                  Host
                </Link>
              </nav>
            )}
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            {!dark && (
              <Link href="/i" className="hidden min-h-10 items-center text-sm font-bold text-brand lg:inline-flex">
                Have an invite code?
              </Link>
            )}
            <UserPicker dark={dark} />
            {!dark && (
              <Link href="/host/new" className="hidden h-10 items-center rounded-[10px] bg-brand px-4 text-sm font-bold text-white sm:inline-flex">
                Host an activity
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className={cn("mx-auto px-4 pb-16 pt-6 sm:px-6 sm:pt-8", container)}>{children}</main>
    </div>
  );
}

/** The "‹ Explore" style breadcrumb above a page title. */
export function Crumb({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-10 items-center gap-1.5 self-start text-sm font-bold text-brand">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {children}
    </Link>
  );
}
