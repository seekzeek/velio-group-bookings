import type { Metadata } from "next";

export const metadata: Metadata = { title: "My invites", description: "Who you've invited, who opened it, and who's in.", robots: { index: false, follow: false } };

export default function InvitesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
