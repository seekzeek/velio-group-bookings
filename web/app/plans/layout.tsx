import type { Metadata } from "next";

export const metadata: Metadata = { title: "My plans", description: "Everything you're going to and everything you're hosting.", robots: { index: false, follow: false } };

export default function PlansLayout({ children }: { children: React.ReactNode }) {
  return children;
}
