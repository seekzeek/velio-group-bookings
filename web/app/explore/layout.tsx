import type { Metadata } from "next";

export const metadata: Metadata = { title: "Explore", description: "What's on this week: outdoors, nights out, food and drink, classes. Book a spot and bring your people." };

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
