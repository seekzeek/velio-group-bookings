"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Illustration, Photo } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Cover } from "./cover";

/*
 * Every photo a host added, not only the cover. The wide page shows the chosen one large with a strip of thumbnails;
 * the phone-width column swipes through them with dots. One photo or none falls back to the plain cover.
 */

export function PhotoGallery({ illustration, photos, className }: { illustration: Illustration; photos: Photo[]; className?: string }) {
  const [index, setIndex] = useState(0);
  const current = photos[index] ?? photos[0];
  if (photos.length <= 1) {
    return (
      <div className={cn("overflow-hidden rounded-3xl shadow-[var(--shadow-card)]", className)}>
        <Cover illustration={illustration} photos={photos} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div className={cn("relative overflow-hidden rounded-3xl bg-ground shadow-[var(--shadow-card)]", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={current!.id} src={current!.url} alt="" className="h-full w-full object-cover" />
        <span className="absolute bottom-3.5 right-3.5 rounded-full bg-ink/80 px-2.5 py-1 text-xs font-bold text-white">
          {index + 1} / {photos.length}
        </span>
        <button type="button" aria-label="Previous photo" onClick={() => setIndex((i) => (i - 1 + photos.length) % photos.length)} className="absolute left-3.5 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-surface/95 text-ink shadow-[var(--shadow-card)]">
          <ChevronLeft className="size-5" />
        </button>
        <button type="button" aria-label="Next photo" onClick={() => setIndex((i) => (i + 1) % photos.length)} className="absolute right-3.5 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-surface/95 text-ink shadow-[var(--shadow-card)]">
          <ChevronRight className="size-5" />
        </button>
      </div>
      <div role="tablist" aria-label="Photos" className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {photos.map((p, i) => (
          <button key={p.id} type="button" role="tab" aria-selected={i === index} aria-label={`Photo ${i + 1}`} onClick={() => setIndex(i)} className={cn("size-16 shrink-0 overflow-hidden rounded-xl transition", i === index ? "ring-2 ring-brand ring-offset-2 ring-offset-ground" : "opacity-80 hover:opacity-100")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Swipe through the photos in a fixed-height box, with dots. Used wherever the layout is a phone column. */
export function PhotoCarousel({ illustration, photos, className }: { illustration: Illustration; photos: Photo[]; className?: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => setIndex(Math.round(el.scrollLeft / el.clientWidth));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  if (photos.length <= 1) {
    return (
      <div className={cn("h-full w-full", className)}>
        <Cover illustration={illustration} photos={photos} />
      </div>
    );
  }
  return (
    <div className={cn("relative h-full w-full", className)}>
      <div ref={track} className="flex h-full w-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]" aria-roledescription="carousel" aria-label="Photos">
        {photos.map((p, i) => (
          <div key={p.id} className="h-full w-full shrink-0 snap-center" aria-label={`Photo ${i + 1} of ${photos.length}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" className="h-full w-full object-cover" draggable={false} />
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
        {photos.map((p, i) => (
          <span key={p.id} className={cn("h-1.5 rounded-full bg-white shadow-[0_1px_2px_rgba(21,23,26,0.3)] transition-all", i === index ? "w-4 opacity-100" : "w-1.5 opacity-60")} />
        ))}
      </div>
    </div>
  );
}
