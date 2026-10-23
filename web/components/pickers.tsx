"use client";

import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/bits";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const triggerClass = "flex h-[50px] w-full items-center gap-2.5 rounded-xl border-[1.5px] border-[#C9CDD3] bg-surface px-3.5 text-left text-[15px] text-ink outline-none focus-visible:border-brand data-[popup-open]:border-brand aria-invalid:border-scarcity-text";
const popupClass = "w-auto gap-0 rounded-2xl bg-surface p-4 text-ink shadow-[0_12px_32px_rgba(21,23,26,0.14)] ring-0";

const pad = (n: number) => String(n).padStart(2, "0");
const toIso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

function parseIso(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) } : null;
}

export function formatPickedDate(value: string) {
  const p = parseIso(value);
  return p ? new Date(p.y, p.m, p.d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "";
}

export function formatPickedTime(value: string) {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m) return "";
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
}

const weekdays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/** A month grid in a popover. Days before `min` can't be picked. Value is YYYY-MM-DD or empty. */
export function DatePicker({ id, value, onChange, invalid = false, min = new Date() }: { id: string; value: string; onChange: (iso: string) => void; invalid?: boolean; min?: Date }) {
  const [open, setOpen] = useState(false);
  const selected = parseIso(value);
  const [view, setView] = useState(() => (selected ? { y: selected.y, m: selected.m } : { y: min.getFullYear(), m: min.getMonth() }));

  const minIso = toIso(min.getFullYear(), min.getMonth(), min.getDate());
  const todayIso = toIso(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const offset = (new Date(view.y, view.m, 1).getDay() + 6) % 7;
  const days = new Date(view.y, view.m + 1, 0).getDate();
  const cells = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const monthLabel = new Date(view.y, view.m, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const atMinMonth = view.y < min.getFullYear() || (view.y === min.getFullYear() && view.m <= min.getMonth());

  const shift = (by: number) => setView((v) => ({ y: v.y + Math.floor((v.m + by) / 12), m: (((v.m + by) % 12) + 12) % 12 }));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger id={id} type="button" className={triggerClass} aria-invalid={invalid || undefined}>
        <CalendarDays className="size-[18px] shrink-0 text-muted-ink" />
        <span className={cn("flex-1", !value && "text-muted-ink")}>{value ? formatPickedDate(value) : "Pick a date"}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-ink" />
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className={popupClass}>
        <div className="flex items-center justify-between pb-3">
          <button type="button" aria-label="Previous month" onClick={() => shift(-1)} disabled={atMinMonth} className="flex size-9 items-center justify-center rounded-[10px] text-ink hover:bg-ground disabled:opacity-30">
            <ChevronLeft className="size-[18px]" />
          </button>
          <span className="text-[15px] font-bold">{monthLabel}</span>
          <button type="button" aria-label="Next month" onClick={() => shift(1)} className="flex size-9 items-center justify-center rounded-[10px] text-ink hover:bg-ground">
            <ChevronRight className="size-[18px]" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {weekdays.map((w) => (
            <span key={w} className="flex h-8 items-center justify-center text-[11px] font-bold uppercase tracking-[0.06em] text-muted-ink">
              {w}
            </span>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <span key={`blank-${i}`} />;
            const iso = toIso(view.y, view.m, day);
            const past = iso < minIso;
            const isSelected = iso === value;
            return (
              <button
                key={iso}
                type="button"
                disabled={past}
                aria-pressed={isSelected}
                onClick={() => {
                  onChange(iso);
                  setOpen(false);
                }}
                className={cn(
                  "mx-auto flex size-10 items-center justify-center rounded-[10px] text-sm",
                  isSelected ? "bg-brand font-bold text-white" : past ? "text-[#C9CDD3]" : "text-ink hover:bg-ground",
                  iso === todayIso && !isSelected && "font-bold text-brand",
                )}
              >
                {day}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const hours = Array.from({ length: 12 }, (_, i) => i + 1);
const minutes = Array.from({ length: 12 }, (_, i) => i * 5);

/** Hour, minute and AM/PM columns in a popover. Value is HH:mm in 24-hour time. */
export function TimePicker({ id, value, onChange, invalid = false }: { id: string; value: string; onChange: (hhmm: string) => void; invalid?: boolean }) {
  const [open, setOpen] = useState(false);
  const [settled, setSettled] = useState(false);
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  const h24 = m ? Number(m[1]) : 18;
  const minute = m ? Number(m[2]) : 0;
  const pm = h24 >= 12;
  const h12 = h24 % 12 || 12;

  const set = (next: { h12?: number; minute?: number; pm?: boolean }) => {
    const nh = next.h12 ?? h12;
    const npm = next.pm ?? pm;
    onChange(`${pad((nh % 12) + (npm ? 12 : 0))}:${pad(next.minute ?? minute)}`);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSettled(false);
      }}
      onOpenChangeComplete={(isOpen) => setSettled(isOpen)}
    >
      <PopoverTrigger id={id} type="button" className={triggerClass} aria-invalid={invalid || undefined}>
        <Clock className="size-[18px] shrink-0 text-muted-ink" />
        <span className={cn("flex-1", !value && "text-muted-ink")}>{value ? formatPickedTime(value) : "Pick a time"}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-ink" />
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className={popupClass}>
        <div className="flex gap-2">
          <Column label="Hour" settled={settled} items={hours.map((h) => ({ key: h, label: String(h), selected: h === h12, pick: () => set({ h12: h }) }))} />
          <Column label="Min" settled={settled} items={minutes.map((mi) => ({ key: mi, label: pad(mi), selected: mi === minute, pick: () => set({ minute: mi }) }))} />
          <Column label="" settled={settled} items={[false, true].map((p) => ({ key: String(p), label: p ? "PM" : "AM", selected: p === pm, pick: () => set({ pm: p }) }))} />
        </div>
        <Button size="nav" className="mt-3 w-full" onClick={() => setOpen(false)}>
          Done
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function Column({ label, items, settled }: { label: string; settled: boolean; items: { key: string | number; label: string; selected: boolean; pick: () => void }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  // The popup has no layout until its open animation ends, so scrolling earlier is clamped to zero.
  useEffect(() => {
    const list = ref.current;
    const picked = list?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (settled && list && picked) list.scrollTop = picked.offsetTop - (list.clientHeight - picked.clientHeight) / 2;
  }, [settled]);
  return (
    <div className="flex flex-col gap-1">
      <span className="h-5 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-ink">{label}</span>
      <div ref={ref} className="relative flex max-h-[220px] w-[60px] flex-col gap-1 overflow-y-auto pr-1">
        {items.map((it) => (
          <button key={it.key} type="button" aria-pressed={it.selected} onClick={it.pick} className={cn("flex h-10 shrink-0 items-center justify-center rounded-[10px] text-sm", it.selected ? "bg-brand font-bold text-white" : "text-ink hover:bg-ground")}>
            {it.label}
          </button>
        ))}
      </div>
    </div>
  );
}
