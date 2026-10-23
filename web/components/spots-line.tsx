"use client";

import { motion } from "motion/react";
import { isScarce, spotsText } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Dot } from "./bits";

type Props = { spotsLeft: number; capacity: number; live?: boolean; short?: boolean; className?: string; bar?: boolean; size?: "card" | "panel"; note?: React.ReactNode };

/** The dot, count, "LIVE" tag and 4px bar that every spot count on the canvas uses. Cards use 14px text, panels 15px. */
export function SpotsLine({ spotsLeft, capacity, live = true, short = false, className, bar = true, size = "panel", note }: Props) {
  const full = spotsLeft <= 0;
  const scarce = isScarce(spotsLeft);
  const text = full ? "text-muted-ink" : scarce ? "text-scarcity-text" : "text-brand-deep";
  const fill = full ? "#9AA1AA" : scarce ? "var(--scarcity-dot)" : "var(--brand)";
  const width = capacity > 0 ? Math.round(((capacity - Math.max(0, spotsLeft)) / capacity) * 100) : 0;
  return (
    <div className={cn("flex flex-col", bar ? "gap-2.5" : "gap-0", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className={cn("inline-flex items-center gap-2.5 font-bold", size === "card" ? "text-sm" : "text-[15px]", text)}>
          <Dot spotsLeft={spotsLeft} />
          <motion.span key={spotsLeft} initial={{ opacity: 0.4, y: 2 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            {spotsText(spotsLeft, capacity, short)}
          </motion.span>
        </span>
        <span className={cn("font-bold uppercase tracking-[0.06em] text-muted-ink", size === "card" ? "text-[11px]" : "text-xs")}>{live ? "Live" : "Not live"}</span>
      </div>
      {bar && (
        <div className="h-1 overflow-hidden rounded-sm bg-line">
          <motion.div className="h-1" style={{ background: fill }} initial={false} animate={{ width: `${width}%` }} transition={{ duration: 0.35 }} />
        </div>
      )}
      {note && <span className="text-xs text-muted-ink">{note}</span>}
    </div>
  );
}
