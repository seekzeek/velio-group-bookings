import type { Metadata } from "next";

export const metadata: Metadata = { title: "Host an activity", description: "List an activity with a date, a price and a limited number of spots.", robots: { index: false, follow: false } };

export default function HostLayout({ children }: { children: React.ReactNode }) {
  return children;
}
