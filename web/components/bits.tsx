"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { errorCopy, type ErrorCode } from "@/lib/errors";
import { cn } from "@/lib/utils";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-[20px] bg-surface shadow-[var(--shadow-card)]", className)}>{children}</div>;
}

export function Cta({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-[17px] font-bold text-white shadow-[var(--shadow-cta)] transition disabled:bg-[#DADDE1] disabled:text-muted-ink disabled:shadow-none",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function CtaLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={cn("flex h-14 w-full items-center justify-center rounded-2xl bg-brand text-[17px] font-bold text-white shadow-[var(--shadow-cta)]", className)}>
      {children}
    </Link>
  );
}

export function SecondaryButton({ className, active, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      {...props}
      className={cn(
        "flex h-12 w-full items-center justify-center rounded-2xl border text-[15px] font-bold transition",
        active ? "border-brand-tint bg-brand-tint text-brand-deep" : "border-[#C9CDD3] bg-surface text-ink hover:bg-ground",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Chip({ tone = "grey", children }: { tone?: "ok" | "warn" | "grey" | "dim"; children: React.ReactNode }) {
  const tones = { ok: "bg-brand-tint text-brand-deep", warn: "bg-warning-bg text-warning-text", grey: "bg-[#EEF0F2] text-body", dim: "bg-[#EEF0F2] text-muted-ink" };
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold", tones[tone])}>{children}</span>;
}

export function Spinner() {
  return <span aria-hidden="true" className="inline-block size-[18px] animate-spin rounded-full border-[2.5px] border-white/35 border-t-white" />;
}

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
          className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-lg"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Notice({ tone = "warn", title, body, children }: { tone?: "warn" | "ok"; title: string; body?: string; children?: React.ReactNode }) {
  return (
    <div role="status" className={cn("flex flex-col gap-1 rounded-2xl p-4", tone === "warn" ? "bg-warning-bg text-warning-text" : "bg-brand-tint text-brand-deep")}>
      <span className="text-[15px] font-bold">{title}</span>
      {body && <span className="text-sm leading-relaxed">{body}</span>}
      {children}
    </div>
  );
}

export function ErrorState({ code, action }: { code: ErrorCode; action?: React.ReactNode }) {
  const copy = errorCopy[code];
  return (
    <div className="flex flex-col items-start gap-3 rounded-[20px] bg-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="text-xl">{copy.title}</h2>
      {copy.body && <p className="text-body">{copy.body}</p>}
      {action ?? (
        <Link href="/explore" className="text-sm font-bold text-brand">
          See what&apos;s coming up
        </Link>
      )}
    </div>
  );
}

export function EmptyState({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-[20px] bg-surface p-6 shadow-[var(--shadow-card)]">
      <div>
        <h2 className="text-xl">{title}</h2>
        <p className="mt-1 text-body">{body}</p>
      </div>
      {children}
    </div>
  );
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-[20px] bg-surface p-5 shadow-[var(--shadow-card)]" aria-busy="true">
      <Skeleton className="mb-4 h-40 w-full rounded-2xl" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("mb-3 h-4 rounded-full", i === 0 ? "w-2/3" : i === 1 ? "w-1/2" : "w-5/6")} />
      ))}
    </div>
  );
}

export function Field({ label, hint, error, htmlFor, children }: { label: React.ReactNode; hint?: React.ReactNode; error?: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-bold text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <span role="alert" className="text-sm font-semibold text-scarcity-text">
          {error}
        </span>
      ) : (
        hint && <span className="text-xs text-muted-ink">{hint}</span>
      )}
    </div>
  );
}

export const inputClass = "h-12 w-full rounded-[14px] border border-[#C9CDD3] bg-surface px-4 text-[15px] text-ink outline-none placeholder:text-muted-ink focus:border-brand focus:ring-2 focus:ring-brand/20 aria-invalid:border-scarcity-text";
