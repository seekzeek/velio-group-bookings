import type { Illustration, Photo } from "@/lib/api";
import { cn } from "@/lib/utils";

/** The illustrated cover for an activity without photos, one per kind, drawn with the same flat shapes as the design. */
export function Cover({ illustration, photos, className }: { illustration: Illustration; photos?: Photo[]; className?: string }) {
  const photo = photos?.[0];
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo.url} alt="" className={cn("h-full w-full object-cover", className)} />;
  }
  return (
    <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className={cn("block h-full w-full", className)}>
      {illustration === "kayak" && (
        <>
          <rect width="400" height="240" fill="#DCEBE8" />
          <circle cx="292" cy="92" r="38" fill="#F5B48B" />
          <rect y="134" width="400" height="106" fill="#B9D7D2" />
          <path d="M0 156c25-6 50-6 75 0s50 6 75 0 50-6 75 0 50 6 75 0 50-6 75 0 25 2 25 2" stroke="#0F5F5C" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M50 190c25-6 50-6 75 0s50 6 75 0 50-6 75 0 50 6 75 0" stroke="#0F5F5C" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.5" />
          <path d="M150 150c18-7 86-7 104 0-18 11-86 11-104 0z" fill="#15171A" />
          <path d="M188 128l30 28" stroke="#15171A" strokeWidth="3" strokeLinecap="round" />
          <circle cx="200" cy="140" r="6" fill="#F3F4F2" />
        </>
      )}
      {illustration === "speakeasy" && (
        <>
          <rect width="400" height="240" fill="#2B2430" />
          <rect x="60" y="60" width="280" height="110" fill="#3A3040" />
          <rect x="60" y="100" width="280" height="4" fill="#5A4A5E" />
          <rect x="60" y="140" width="280" height="4" fill="#5A4A5E" />
          <rect x="90" y="74" width="14" height="26" fill="#C9A24A" />
          <rect x="120" y="70" width="12" height="30" fill="#7A9E8E" />
          <rect x="150" y="78" width="16" height="22" fill="#B86B5A" />
          <rect x="230" y="72" width="12" height="28" fill="#7A9E8E" />
          <rect x="260" y="76" width="16" height="24" fill="#C9A24A" />
          <rect x="296" y="70" width="12" height="30" fill="#B86B5A" />
          <rect x="100" y="114" width="14" height="26" fill="#B86B5A" />
          <rect x="140" y="112" width="12" height="28" fill="#C9A24A" />
          <rect x="250" y="116" width="16" height="24" fill="#7A9E8E" />
          <rect x="290" y="112" width="12" height="28" fill="#C9A24A" />
          <rect y="176" width="400" height="64" fill="#1C171F" />
          <path d="M130 0v34M270 0v34" stroke="#8A7A8E" strokeWidth="2" />
          <circle cx="130" cy="44" r="18" fill="#F0C98A" opacity="0.18" />
          <circle cx="270" cy="44" r="18" fill="#F0C98A" opacity="0.18" />
          <circle cx="130" cy="42" r="8" fill="#F0C98A" />
          <circle cx="270" cy="42" r="8" fill="#F0C98A" />
        </>
      )}
      {illustration === "hike" && (
        <>
          <rect width="400" height="240" fill="#E4EBD6" />
          <circle cx="110" cy="96" r="34" fill="#F5B48B" />
          <path d="M0 190c60-70 120-80 180-40 40-30 80-40 140-20 30 10 60 30 80 60v50H0z" fill="#9DBA8C" />
          <path d="M0 240v-40c50-40 100-50 160-20 50-25 110-25 160 10 30 20 60 30 80 50z" fill="#6F9468" />
          <path d="M0 240v-18c70-30 140-30 210 0 60-20 130-14 190 18z" fill="#4E7047" />
        </>
      )}
      {illustration === "pottery" && (
        <>
          <rect width="400" height="240" fill="#F4E1D2" />
          <rect x="150" y="196" width="100" height="14" rx="4" fill="#8A5A44" />
          <path d="M140 190h120l-10-14H150z" fill="#6E4635" />
          <path d="M170 176c-14-30-16-70 6-96h48c22 26 20 66 6 96z" fill="#C97B5A" />
          <rect x="166" y="72" width="68" height="12" rx="6" fill="#B86B4C" />
          <path d="M184 100c-6 20-6 44 0 64" stroke="#E6A784" strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d="M254 176h-14M146 176h-14" stroke="#8A5A44" strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {illustration === "salsa" && (
        <>
          <rect width="400" height="240" fill="#2B2F36" />
          <path d="M0 40c100 60 300 60 400 0" stroke="#6B707A" strokeWidth="2" fill="none" />
          <path d="M0 90c100 60 300 60 400 0" stroke="#6B707A" strokeWidth="2" fill="none" />
          {[60, 130, 200, 270, 340].map((x, i) => (
            <circle key={x} cx={x} cy={[62, 78, 84, 78, 62][i]} r="6" fill="#F5D58A" />
          ))}
          {[40, 110, 200, 290, 360].map((x, i) => (
            <circle key={x} cx={x} cy={[106, 126, 134, 126, 106][i]} r="6" fill="#F5D58A" />
          ))}
          <circle cx="60" cy="62" r="14" fill="#F5D58A" opacity="0.14" />
          <circle cx="200" cy="84" r="14" fill="#F5D58A" opacity="0.14" />
          <circle cx="340" cy="62" r="14" fill="#F5D58A" opacity="0.14" />
          <rect y="196" width="400" height="44" fill="#3D424A" />
          <rect y="190" width="400" height="6" fill="#4E545D" />
        </>
      )}
      {illustration === "market" && (
        <>
          <rect width="400" height="240" fill="#F3EAC9" />
          <rect x="40" y="60" width="320" height="40" fill="#C0504A" />
          {[80, 160, 240, 320].map((x) => (
            <rect key={x} x={x} y="60" width="40" height="40" fill="#FFFFFF" />
          ))}
          <path d="M40 100h320l-10 14H50z" fill="#9E3E3A" />
          <rect x="70" y="150" width="260" height="60" fill="#8A5A44" />
          <rect x="60" y="140" width="280" height="14" rx="3" fill="#6E4635" />
          <circle cx="110" cy="130" r="12" fill="#6F9468" />
          <circle cx="136" cy="130" r="12" fill="#6F9468" />
          <circle cx="200" cy="130" r="12" fill="#D9A441" />
          <circle cx="226" cy="130" r="12" fill="#D9A441" />
          <circle cx="290" cy="130" r="12" fill="#C0504A" />
          <circle cx="316" cy="130" r="12" fill="#C0504A" />
          <rect y="210" width="400" height="30" fill="#D9CFA8" />
        </>
      )}
      {illustration === "other" && (
        <>
          <rect width="400" height="240" fill="#E3F1EF" />
          <circle cx="120" cy="110" r="44" fill="#0F5F5C" opacity="0.18" />
          <circle cx="250" cy="130" r="64" fill="#0F5F5C" opacity="0.12" />
          <rect x="60" y="180" width="280" height="12" rx="6" fill="#0F5F5C" opacity="0.3" />
        </>
      )}
    </svg>
  );
}
