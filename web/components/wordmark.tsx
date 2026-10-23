import { cn } from "@/lib/utils";

type Tone = "brand" | "ink" | "light";

const text: Record<Tone, string> = { brand: "text-brand", ink: "text-ink", light: "text-white" };
const dot: Record<Tone, string> = { brand: "bg-scarcity-dot", ink: "bg-ink", light: "bg-[#FBE38E]" };

/** The wordmark from the brand board: lowercase, the i without its dot, and the full stop carrying it. Sized by the font size you give it. */
export function Wordmark({ tone = "ink", className }: { tone?: Tone; className?: string }) {
  return (
    <span aria-label="Velio" className={cn("inline-flex items-baseline font-heading font-extrabold leading-none tracking-[-0.05em]", text[tone], className)}>
      <span aria-hidden="true">velıo</span>
      <span aria-hidden="true" className={cn("ml-[0.06em] inline-block size-[0.24em] rounded-full", dot[tone])} />
    </span>
  );
}
