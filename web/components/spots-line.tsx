"use client";

import { motion } from "motion/react";
import { isScarce, spotsText } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = { spotsLeft: number; capacity: number; live?: boolean; short?: boolean; booked?: boolean; className?: string; bar?: boolean };

/** The dot, text, bar and "Live" tag that every spot count on the canvas uses. */
export function SpotsLine({ spotsLeft, capacity, live = true, short = false, booked = false, className, bar = true }: Props) {
  const full = spotsLeft <= 0;
  const scarce = isScarce(spotsLeft);
  const dot = full ? "#9AA1AA" : scarce ? "var(--scarcity-dot)" : "var(--brand)";
  const text = full ? "text-muted-ink" : scarce ? "text-scarcity-text" : "text-brand-deep";
  const taken = booked ? capacity - spotsLeft : capacity - spotsLeft;
  const width = capacity > 0 ? Math.round((taken / capacity) * 100) : 0;
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <div className="flex items-center justify-between">
        <span className={cn("inline-flex items-center gap-2.5 text-[15px] font-bold", text)}>
          <span className="size-2 rounded-full" style={{ background: dot, boxShadow: `0 0 0 4px color-mix(in srgb, ${dot} 18%, transparent)` }} />
          <motion.span key={spotsLeft} initial={{ opacity: 0.4, y: 2 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            {spotsText(spotsLeft, capacity, short)}
          </motion.span>
        </span>
        <span className="text-xs font-bold uppercase tracking-[0.06em] text-muted-ink">{live ? "Live" : "Not live"}</span>
      </div>
      {bar && (
        <div className="h-1 overflow-hidden rounded-sm bg-line">
          <motion.div className="h-1" style={{ background: dot }} initial={false} animate={{ width: `${width}%` }} transition={{ duration: 0.35 }} />
        </div>
      )}
    </div>
  );
}
