"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect } from "react";
import { Avatar } from "@/components/avatar";
import { Dot } from "@/components/bits";
import { spotsText } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * The phone screens from the canvas, drawn for the web under 640px. Every page keeps its 20px gutter inside these,
 * because the shell gives the phone layouts the full width.
 */

/** A phone screen fills the viewport under the 52px header, so a bottom bar can sit at the bottom even when the content is short. */
export function Screen({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex min-h-[calc(100dvh-52px)] flex-col", className)}>{children}</div>;
}

/** The white bar pinned to the bottom of a phone screen: price and CTA, or a pair of actions. */
export function BottomBar({ children, className, column = false }: { children: React.ReactNode; className?: string; column?: boolean }) {
  return <div className={cn("sticky bottom-0 z-10 mt-auto flex gap-2.5 bg-surface px-5 pb-6 pt-3 shadow-[0_-1px_0_var(--line)]", column ? "flex-col" : "items-center", className)}>{children}</div>;
}

export function H1({ children, className, size = 30 }: { children: React.ReactNode; className?: string; size?: 26 | 28 | 30 | 32 }) {
  const sizes = { 26: "text-[26px] tracking-[-0.025em]", 28: "text-[28px] leading-[1.05] tracking-[-0.025em]", 30: "text-[30px] leading-[1.05] tracking-[-0.025em]", 32: "text-[32px] leading-[1.02] tracking-[-0.03em]" };
  return <h1 className={cn(sizes[size], className)}>{children}</h1>;
}

/** The 44px white circle for back and close. */
export function CircleButton({ href, onClick, label, children, className }: { href?: string; onClick?: () => void; label: string; children: React.ReactNode; className?: string }) {
  const cls = cn("flex size-11 shrink-0 items-center justify-center rounded-full bg-surface text-ink shadow-[var(--shadow-card)]", className);
  if (href) {
    return (
      <Link href={href} aria-label={label} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" aria-label={label} onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

export const ChevronLeft = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

export const Cross = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

export const Tick = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

/** The dot and count, in the size the screen uses: 13 on cards, 14 on hosting cards, 15 in spots cards, 18 on attendance. */
export function DotLine({ spotsLeft, text, size = 13, className, children }: { spotsLeft: number; text: string; size?: 13 | 14 | 15 | 18; className?: string; children?: React.ReactNode }) {
  const colour = spotsLeft <= 0 ? "text-muted-ink" : spotsLeft <= 3 ? "text-scarcity-text" : "text-brand-deep";
  const sizes = { 13: "gap-2 text-[13px]", 14: "gap-2 text-sm", 15: "gap-2.5 text-[15px]", 18: "gap-2.5 text-lg" };
  return (
    <span className={cn("inline-flex items-center font-bold", sizes[size], colour, className)}>
      <Dot spotsLeft={spotsLeft} /> {text}
      {children}
    </span>
  );
}

export function LiveTag({ live = true, size = 11 }: { live?: boolean; size?: 11 | 12 }) {
  return <span className={cn("font-bold uppercase tracking-[0.06em] text-muted-ink", size === 11 ? "text-[11px]" : "text-xs")}>{live ? "Live" : "Not live"}</span>;
}

export function Bar({ spotsLeft, capacity }: { spotsLeft: number; capacity: number }) {
  const fill = spotsLeft <= 0 ? "#9AA1AA" : spotsLeft <= 3 ? "var(--scarcity-dot)" : "var(--brand)";
  const width = capacity > 0 ? Math.round(((capacity - Math.max(0, spotsLeft)) / capacity) * 100) : 0;
  return (
    <span className="block h-1 overflow-hidden rounded-sm bg-line">
      <motion.span className="block h-1" style={{ background: fill }} initial={false} animate={{ width: `${width}%` }} transition={{ duration: 0.35 }} />
    </span>
  );
}

/** The white spots card: count, Live, bar and one line under it. */
export function SpotsCard({ spotsLeft, capacity, live, hint, text, big = false, className }: { spotsLeft: number; capacity: number; live: boolean; hint: string; text?: string; big?: boolean; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2.5 rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)]", className)}>
      <div className="flex items-center justify-between">
        <DotLine spotsLeft={spotsLeft} text={text ?? spotsText(spotsLeft, capacity)} size={big ? 18 : 15} />
        <LiveTag live={live} size={12} />
      </div>
      <Bar spotsLeft={spotsLeft} capacity={capacity} />
      <span className="text-[13px] text-muted-ink">{hint}</span>
    </div>
  );
}

export function IconRow({ icon, children, className }: { icon: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5 text-sm text-body", className)}>
      <span className="shrink-0 text-body">{icon}</span>
      <span className="min-w-0">{children}</span>
    </span>
  );
}

export const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="3" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);
export const PinIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1116 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
export const UsersIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="9" cy="8" r="4" />
    <path d="M2 21a7 7 0 0114 0M16 4a4 4 0 010 8M22 21a7 7 0 00-6-6.9" />
  </svg>
);
export const CoinIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M14.5 9.5a2.5 2.5 0 00-5 0c0 3 5 2 5 5a2.5 2.5 0 01-5 0M12 6v1.5M12 16.5V18" />
  </svg>
);

/** Overlapping 30px avatars with a white ring, the way the phone cards stack a group. "?" is a vouch nobody has claimed. */
export function Stack({ names, size = 30 }: { names: string[]; size?: number }) {
  return (
    <span className="flex shrink-0">
      {names.slice(0, 4).map((n, i) =>
        n === "?" ? (
          <span key={`q-${i}`} className={cn("flex items-center justify-center rounded-full border-2 border-dashed border-[#C9CDD3] bg-surface text-sm font-bold text-muted-ink", i > 0 && "-ml-2")} style={{ width: size, height: size }} aria-hidden="true">
            ?
          </span>
        ) : (
          <Avatar key={`${n}-${i}`} name={n} size={size} className={cn("border-2 border-surface", i > 0 && "-ml-2")} />
        ),
      )}
    </span>
  );
}

/** The two-way switch on My plans: grey track, white selected segment. */
export function SegmentedTabs({ labels, index, onChange, label }: { labels: string[]; index: number; onChange: (i: number) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="grid grid-cols-2 gap-1 rounded-[14px] bg-[#E6E8E6] p-1">
      {labels.map((l, i) => (
        <button key={l} type="button" role="tab" aria-selected={index === i} onClick={() => onChange(i)} className={cn("h-10 rounded-[10px] text-sm font-bold text-ink", index === i && "bg-surface shadow-[0_1px_2px_rgba(21,23,26,0.08)]")}>
          {l}
        </button>
      ))}
    </div>
  );
}

/** The 40px rounded icon box that starts a card: tint for vouches, grey for links. */
export function IconBox({ tone = "tint", children }: { tone?: "tint" | "grey"; children: React.ReactNode }) {
  return <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", tone === "tint" ? "bg-brand-tint text-brand" : "bg-[#EEF0F2] text-body")}>{children}</span>;
}

/** The filter pills under a phone title. 40px on Explore, 36px on My invites. */
export function PillRow({ children, height = 40, className }: { children: React.ReactNode; height?: 36 | 40; className?: string }) {
  return <div className={cn("flex gap-2 overflow-x-auto px-5 [scrollbar-width:none]", height === 40 ? "pt-4" : "pt-4", className)}>{children}</div>;
}

export function Pill({ pressed, onClick, children, height = 40 }: { pressed: boolean; onClick: () => void; children: React.ReactNode; height?: 36 | 40 }) {
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick} className={cn("shrink-0 whitespace-nowrap rounded-full px-3.5", height === 40 ? "h-10 text-sm" : "h-9 text-[13px]", pressed ? "bg-ink font-bold text-white" : "bg-surface font-semibold text-ink shadow-[var(--shadow-card)]")}>
      {children}
    </button>
  );
}

/** The 64px icon circle, heading and line the phone empty states share. */
export function EmptyBlock({ icon, title, body, children, className }: { icon?: React.ReactNode; title: string; body: string; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-1 flex-col items-center gap-4 px-5 pt-10 text-center", className)}>
      {icon && <span className="flex size-16 items-center justify-center rounded-full bg-surface text-brand shadow-[var(--shadow-card)]">{icon}</span>}
      <div className="flex flex-col gap-2">
        <h2 className="text-[22px] leading-[1.1] tracking-[-0.02em]">{title}</h2>
        <p className="max-w-[280px] text-[15px] leading-relaxed text-body">{body}</p>
      </div>
      {children}
    </div>
  );
}

/** The toast as the phone draws it: an ink pill under the top edge with the scarcity dot, next to the back button. */
export function PhoneToast({ message, onDone, className }: { message: string | null; onDone: () => void; className?: string }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [message, onDone]);
  return (
    <AnimatePresence>
      {message && (
        <motion.div role="status" aria-live="polite" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className={cn("absolute left-[76px] right-5 top-4 z-10 flex items-center gap-2.5 rounded-[14px] bg-ink px-3.5 py-2.5 text-[13px] font-semibold text-white shadow-[0_8px_24px_rgba(21,23,26,0.24)]", className)}>
          <span className="size-2 shrink-0 rounded-full bg-scarcity-dot shadow-[0_0_0_4px_rgba(232,100,44,0.28)]" />
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** The bottom sheet: dim the page, slide a ground-coloured panel up with a drag handle. */
export function Sheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button type="button" aria-label="Close" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-40 bg-ink/45" />
          <motion.div role="dialog" aria-modal="true" aria-label={label} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 420, damping: 38 }} className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col gap-3.5 overflow-y-auto rounded-t-3xl bg-ground px-5 pb-8 pt-2 shadow-[0_-8px_32px_rgba(21,23,26,0.18)]">
            <button type="button" aria-label="Close" onClick={onClose} className="flex h-5 w-11 shrink-0 items-center justify-center self-center">
              <span className="block h-1 w-9 rounded-sm bg-[#C9CDD3]" />
            </button>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
