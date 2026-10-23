import type { Metadata } from "next";

export const metadata: Metadata = { title: { default: "Host", template: "Velio · %s" }, description: "Create an activity, share the link, vouch for people and watch bookings land live.", robots: { index: false, follow: false } };

export default function HostLayout({ children }: { children: React.ReactNode }) {
  return children;
}
