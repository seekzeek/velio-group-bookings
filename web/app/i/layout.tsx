import type { Metadata } from "next";

export const metadata: Metadata = { title: "Enter an invite code", description: "Got a code from a friend? Enter it to claim your spot." };

export default function ILayout({ children }: { children: React.ReactNode }) {
  return children;
}
