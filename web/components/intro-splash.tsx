"use client";

import { useEffect, useState } from "react";
import { Wordmark } from "./wordmark";

const KEY = "velio.intro";

/**
 * The 900 ms intro from the brand board, once per browser session on wide screens only. Phones go straight to the page.
 * Skipped when the person asked for reduced motion. Removed from the DOM when it is done, so nothing sits over the page.
 */
export function IntroSplash() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let seen = true;
    try {
      seen = sessionStorage.getItem(KEY) === "1";
    } catch {
      seen = true;
    }
    const wide = window.matchMedia("(min-width: 640px)").matches;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (seen || !wide || still) return;
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      // Private mode. Showing it twice is fine.
    }
    const start = requestAnimationFrame(() => setShow(true));
    const stop = setTimeout(() => setShow(false), 1400);
    return () => {
      cancelAnimationFrame(start);
      clearTimeout(stop);
    };
  }, []);

  if (!show) return null;
  return (
    <div aria-hidden="true" className="intro fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0B4745]">
      <div className="relative flex items-baseline">
        <span className="intro-letters font-heading text-[clamp(64px,10vw,128px)] font-extrabold leading-none tracking-[-0.05em] text-white">velıo</span>
        <span className="intro-dot absolute size-[0.24em] rounded-full bg-[#FBE38E] text-[clamp(64px,10vw,128px)]" />
      </div>
      <p className="intro-tagline mt-4 font-sans text-[clamp(18px,2.2vw,28px)] text-[#D7E4E2]">Plans that actually happen.</p>
      <span className="sr-only">
        <Wordmark tone="light" />
      </span>
    </div>
  );
}
