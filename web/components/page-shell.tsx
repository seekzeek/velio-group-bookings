"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { UserPicker } from "./user-picker";

const nav = [
  { href: "/explore", label: "Explore", short: "Explore" },
  { href: "/plans", label: "My plans", short: "Plans" },
  { href: "/invites", label: "My invites", short: "Invites" },
  { href: "/host", label: "Host", short: "Host", wideHidden: true },
];

export function PageShell({ children, wide = false, bare = false }: { children: React.ReactNode; wide?: boolean; bare?: boolean }) {
  const pathname = usePathname();
  return (
    <div className="min-h-dvh bg-ground">
      {!bare && (
        <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
          <div className={cn("mx-auto flex h-16 items-center justify-between gap-4 px-4", wide ? "max-w-7xl" : "max-w-6xl")}>
            <div className="flex items-center gap-6">
              <Link href="/explore" className="font-heading text-xl font-bold tracking-tight text-ink">
                velio
              </Link>
              <nav aria-label="Main" className="flex items-center gap-1">
                {nav.map((item) => {
                  const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={current ? "page" : undefined}
                      className={cn(
                        "rounded-full px-3 py-2 text-sm font-semibold",
                        current ? "bg-ground text-ink" : "text-muted-ink hover:text-ink",
                        item.wideHidden && "sm:hidden",
                      )}
                    >
                      <span className="sm:hidden">{item.short}</span>
                      <span className="hidden sm:inline">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/i" className="hidden text-sm font-bold text-brand md:inline">
                Have an invite code?
              </Link>
              <UserPicker />
              <Link href="/host/new" className="hidden h-9 items-center rounded-xl bg-brand px-3.5 text-sm font-bold text-white sm:inline-flex">
                Host an activity
              </Link>
            </div>
          </div>
        </header>
      )}
      <main className={cn("mx-auto px-4 pb-16 pt-6", wide ? "max-w-7xl" : "max-w-6xl")}>{children}</main>
    </div>
  );
}
