import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Manrope } from "next/font/google";
import "./globals.css";
import { IntroSplash } from "@/components/intro-splash";
import { Providers } from "./providers";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-manrope",
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-bricolage",
  display: "swap",
});

const description = "Book a spot, then bring your people. Group plans with live availability and invites.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000"),
  title: { default: "Velio", template: "Velio · %s" },
  description,
  applicationName: "Velio",
  keywords: ["group bookings", "book activities with friends", "group plans", "invite friends", "things to do this week", "live availability", "kayaking", "classes", "nights out"],
  appleWebApp: { title: "Velio" },
  formatDetection: { telephone: false },
  openGraph: { siteName: "Velio", type: "website", title: "Velio", description, images: ["/apple-icon.png"] },
  twitter: { card: "summary", title: "Velio", description },
};

export const viewport: Viewport = {
  themeColor: "#f3f4f2",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${bricolage.variable}`}>
      <body className="min-h-dvh">
        <IntroSplash />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
