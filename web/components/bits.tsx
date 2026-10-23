"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { errorCopy, type ErrorCode } from "@/lib/errors";
import { cn } from "@/lib/utils";

/*
 * Controls sized exactly as the design canvas sizes them. Each size is one spot on the canvas:
 *   nav    40px, radius 10, 14px    header actions and "Invite friends" on a card
 *   card   44px, radius 12, 15px    "Book a spot" on an Explore card, host page actions
 *   field  46px, radius 12, 15px    buttons beside an input
 *   row    48px, radius 12, 15px    published page, hosting cards, vouch-sent actions
 *   soft   48px, radius 16, 15px    secondary choices under a CTA (calendar, watch)
 *   wide   52px, radius 16, 16px    the other-date link under sold out
 *   cta    56px, radius 16, 17px    the one main action on a screen, with the teal shadow
 */
export type ButtonSize = "nav" | "card" | "field" | "row" | "soft" | "wide" | "cta" | "publish";
export type ButtonVariant = "primary" | "outline" | "tint" | "ink" | "warning" | "dashed";

const sizes: Record<ButtonSize, string> = {
  nav: "h-10 rounded-[10px] px-4 text-sm",
  card: "h-11 rounded-xl px-4 text-[15px]",
  field: "h-[46px] rounded-xl px-4 text-[15px]",
  row: "h-12 rounded-xl px-5 text-[15px]",
  soft: "h-12 rounded-2xl px-5 text-[15px] font-semibold",
  wide: "h-[52px] rounded-2xl px-5 text-base",
  cta: "h-14 rounded-2xl px-6 text-[17px] shadow-[var(--shadow-cta)]",
  publish: "h-[54px] rounded-2xl px-7 text-base",
};

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white",
  outline: "border-[1.5px] border-[#C9CDD3] bg-surface text-ink",
  tint: "border-[1.5px] border-brand-tint bg-brand-tint text-brand-deep shadow-none",
  ink: "bg-ink text-white",
  warning: "bg-warning-text text-white",
  dashed: "border-[1.5px] border-dashed border-brand text-brand",
};

const base = "inline-flex shrink-0 items-center justify-center gap-2 font-bold whitespace-nowrap transition disabled:cursor-default disabled:bg-[#DADDE1] disabled:text-muted-ink disabled:shadow-none disabled:border-transparent";

// The teal shadow belongs to the filled main action only; an outlined or tinted 56px button sits flat.
const sizing = (size: ButtonSize, variant: ButtonVariant) => (size === "cta" && variant !== "primary" ? sizes.cta.replace(" shadow-[var(--shadow-cta)]", "") : sizes[size]);

export function Button({ size = "row", variant = "primary", block = false, className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { size?: ButtonSize; variant?: ButtonVariant; block?: boolean }) {
  return (
    <button type="button" {...props} className={cn(base, sizing(size, variant), variants[variant], block && "flex w-full", className)}>
      {children}
    </button>
  );
}

export function ButtonLink({ href, size = "row", variant = "primary", block = false, className, children }: { href: string; size?: ButtonSize; variant?: ButtonVariant; block?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={cn(base, sizing(size, variant), variants[variant], block && "flex w-full", className)}>
      {children}
    </Link>
  );
}

/** Text-only action, 14px bold in the brand colour, with a 36 to 40px hit area. */
export function TextLink({ href, className, children, muted = false }: { href: string; className?: string; children: React.ReactNode; muted?: boolean }) {
  return (
    <Link href={href} className={cn("inline-flex min-h-9 items-center text-sm font-bold", muted ? "text-muted-ink" : "text-brand", className)}>
      {children}
    </Link>
  );
}

export function TextButton({ className, children, muted = false, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { muted?: boolean }) {
  return (
    <button type="button" {...props} className={cn("inline-flex min-h-9 items-center text-sm font-bold", muted ? "text-muted-ink" : "text-brand", className)}>
      {children}
    </button>
  );
}

/** A native select drawn the way the canvas draws every dropdown: 1.5px border, rounded, with a chevron. */
export function Select({ size = "nav", className, children, ...props }: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> & { size?: "nav" | "sort" | "field" }) {
  const sizing = size === "nav" ? "h-10 rounded-[10px] text-sm font-semibold" : size === "sort" ? "h-11 rounded-xl text-sm font-semibold" : "h-[50px] rounded-xl text-[15px]";
  return (
    <span className={cn("relative inline-flex", className)}>
      <select {...props} className={cn("w-full cursor-pointer appearance-none border-[1.5px] border-[#C9CDD3] bg-surface pl-3 pr-9 text-ink outline-none focus:border-brand", sizing)}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-ink" />
    </span>
  );
}

/** Inputs: field 46px beside a button, form 50px in the create form, guest 52px on the phone screens, code 60px. */
export const inputClass = "h-[46px] w-full rounded-xl border-[1.5px] border-[#C9CDD3] bg-surface px-3.5 text-[15px] text-ink outline-none placeholder:text-muted-ink focus:border-brand aria-invalid:border-scarcity-text";
export const formInputClass = "h-[50px] w-full rounded-xl border-[1.5px] border-[#C9CDD3] bg-surface px-3.5 text-[15px] text-ink outline-none placeholder:text-muted-ink focus:border-brand aria-invalid:border-scarcity-text";
export const guestInputClass = "h-[52px] w-full rounded-xl border-[1.5px] border-[#C9CDD3] bg-surface px-3.5 text-base text-ink outline-none placeholder:text-muted-ink focus:border-brand aria-invalid:border-scarcity-text";

export function Card({ className, children, radius = 20 }: { className?: string; children: React.ReactNode; radius?: 14 | 16 | 18 | 20 | 24 }) {
  const r = { 14: "rounded-[14px]", 16: "rounded-2xl", 18: "rounded-[18px]", 20: "rounded-[20px]", 24: "rounded-3xl" }[radius];
  return <div className={cn("bg-surface shadow-[var(--shadow-card)]", r, className)}>{children}</div>;
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn("font-sans text-xs font-bold uppercase tracking-[0.06em] text-muted-ink", className)}>{children}</h2>;
}

export function Chip({ tone = "grey", children, className }: { tone?: "ok" | "warn" | "grey" | "dim" | "ink" | "fired"; children: React.ReactNode; className?: string }) {
  const tones = {
    ok: "bg-brand-tint text-brand-deep",
    warn: "bg-warning-bg text-warning-text",
    grey: "bg-[#EEF0F2] text-body",
    dim: "bg-[#EEF0F2] text-muted-ink",
    ink: "bg-ink text-white",
    fired: "bg-warning-text text-white",
  };
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold", tones[tone], className)}>{children}</span>;
}

export function Spinner() {
  return <span aria-hidden="true" className="inline-block size-[18px] animate-spin rounded-full border-[2.5px] border-white/35 border-t-white" />;
}

/** The "Someone just booked" toast: bottom-left of the page, ink on white, with the scarcity dot. */
export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [message, onDone]);
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className="fixed bottom-6 left-6 z-30 flex items-center gap-3 rounded-[14px] bg-ink px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(21,23,26,0.24)]"
        >
          <span className="size-2 rounded-full bg-scarcity-dot shadow-[0_0_0_4px_rgba(232,100,44,0.28)]" />
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Notice({ tone = "warn", title, body, children, icon }: { tone?: "warn" | "ok"; title: string; body?: string; children?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div role="status" className={cn("flex flex-col gap-1 rounded-2xl p-4", tone === "warn" ? "bg-warning-bg text-warning-text" : "bg-brand-tint text-brand-deep")}>
      <span className="inline-flex items-center gap-2 text-[15px] font-bold">
        {icon}
        {title}
      </span>
      {body && <span className="text-sm leading-relaxed">{body}</span>}
      {children}
    </div>
  );
}

export function ErrorState({ code, action }: { code: ErrorCode; action?: React.ReactNode }) {
  const copy = errorCopy[code];
  return (
    <Card className="flex flex-col items-start gap-3 p-6">
      <h2 className="text-xl">{copy.title}</h2>
      {copy.body && <p className="text-body">{copy.body}</p>}
      {action ?? <TextLink href="/explore">See what&apos;s coming up</TextLink>}
    </Card>
  );
}

/** The centred empty card from the canvas: 64px icon circle, 24px heading, one line, actions. */
export function EmptyState({ title, body, icon, children }: { title: string; body: string; icon?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <Card className="flex flex-col items-center gap-4 px-6 py-12 text-center">
      {icon && <span className="flex size-16 items-center justify-center rounded-full bg-ground text-brand">{icon}</span>}
      <div className="flex flex-col gap-1.5">
        <h2 className="text-2xl leading-tight">{title}</h2>
        <p className="text-body">{body}</p>
      </div>
      {children && <div className="flex flex-wrap items-center justify-center gap-3">{children}</div>}
    </Card>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <span className={cn("block rounded-lg bg-line", className)} />;
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <Card className="p-5" aria-busy="true">
      <Skeleton className="mb-4 h-40 w-full rounded-2xl" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("mb-3 h-4 rounded-full", i === 0 ? "w-2/3" : i === 1 ? "w-1/2" : "w-5/6")} />
      ))}
    </Card>
  );
}

export function Field({ label, hint, error, htmlFor, children, labelClass = "text-sm font-bold text-ink" }: { label: React.ReactNode; hint?: React.ReactNode; error?: string; htmlFor: string; children: React.ReactNode; labelClass?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      {children}
      {error ? (
        <span role="alert" className="text-[13px] font-semibold text-scarcity-text">
          {error}
        </span>
      ) : (
        hint && <span className="text-xs text-muted-ink">{hint}</span>
      )}
    </div>
  );
}

/** The dot that sits before a spots count, with its halo. */
export function Dot({ spotsLeft, className }: { spotsLeft: number; className?: string }) {
  const colour = spotsLeft <= 0 ? "#9AA1AA" : spotsLeft <= 3 ? "var(--scarcity-dot)" : "var(--brand)";
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", className)} style={{ background: colour, boxShadow: `0 0 0 4px color-mix(in srgb, ${colour} 18%, transparent)` }} />;
}
