import type { Metadata } from "next";
import { API_BASE_URL, type Activity } from "@/lib/api";
import { formatMoney, formatWhen } from "@/lib/format";

type Props = { params: Promise<{ id: string }>; children: React.ReactNode };

// Same idea as the invite landing: the activity link should preview as the activity, not as "Velio".
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  let activity: Activity | null = null;
  try {
    const res = await fetch(`${API_BASE_URL}/activities/${encodeURIComponent(id)}`, { cache: "no-store", signal: AbortSignal.timeout(1500) });
    if (res.ok) activity = ((await res.json()) as { activity: Activity }).activity;
  } catch {
    activity = null;
  }
  if (!activity) return { title: "Activity" };

  const spots = activity.status === "started" ? "Already started" : activity.spotsLeft === 0 ? "Full right now" : `${activity.spotsLeft} of ${activity.capacity} spots left`;
  const description = `${formatWhen(activity.startsAt, activity.timezone)} · ${activity.location} · ${formatMoney(activity.price)} · ${spots}`;
  const image = activity.photos[0]?.url ?? "/apple-icon.png";
  return {
    title: activity.title,
    description,
    openGraph: { title: activity.title, description, images: [image], type: "website" },
    twitter: { card: activity.photos[0] ? "summary_large_image" : "summary", title: activity.title, description, images: [image] },
  };
}

export default function ActivityLayout({ children }: Props) {
  return children;
}
