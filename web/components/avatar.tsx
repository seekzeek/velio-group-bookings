import { avatarColour, initial } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Avatar({ name, size = 32, className, colour }: { name: string; size?: number; className?: string; colour?: string }) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white", className)}
      style={{ width: size, height: size, background: colour ?? avatarColour(name), fontSize: Math.round(size * 0.42) }}
      aria-hidden="true"
    >
      {initial(name)}
    </span>
  );
}

export function AvatarStack({ names, size = 32 }: { names: string[]; size?: number }) {
  return (
    <span className="flex">
      {names.slice(0, 4).map((n, i) => (
        <Avatar key={`${n}-${i}`} name={n} size={size} className={cn("border-2 border-ground", i > 0 && "-ml-2")} />
      ))}
    </span>
  );
}
