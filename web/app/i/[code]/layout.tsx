import type { Metadata } from "next";
import { API_BASE_URL, type ResolvedInvite } from "@/lib/api";
import { formatWhen } from "@/lib/format";

type Props = { params: Promise<{ code: string }>; children: React.ReactNode };

// The invite link is what gets pasted into a group chat, so the preview carries the activity, the date and the spots left.
// Read server side from the public lookup; if the backend is unreachable the page still renders with the default tags.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  let invite: ResolvedInvite | null = null;
  try {
    const res = await fetch(`${API_BASE_URL}/invites/${encodeURIComponent(code)}`, { cache: "no-store", signal: AbortSignal.timeout(1500) });
    if (res.ok) invite = (await res.json()) as ResolvedInvite;
  } catch {
    invite = null;
  }
  if (!invite) return { title: "You're invited" };

  const a = invite.activity;
  const when = formatWhen(a.startsAt, a.timezone);
  const spots =
    invite.status !== "open" ? "This invite is no longer open" : a.spotsLeft === 0 ? "Full right now" : `${a.spotsLeft} of ${a.capacity} spots left`;
  const title = `${invite.inviter.displayName} invited you to ${a.title}`;
  const description = `${when} · ${a.location} · ${spots}`;
  const image = a.photos[0]?.url ?? "/apple-icon.png";
  return {
    title,
    description,
    openGraph: { title, description, images: [image], type: "website" },
    twitter: { card: a.photos[0] ? "summary_large_image" : "summary", title, description, images: [image] },
    robots: { index: false, follow: false },
  };
}

export default function InviteLayout({ children }: Props) {
  return children;
}
