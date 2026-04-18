import type { Metadata, Viewport } from "next";
import { Lora, Nunito } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const tabTitle = "sytt";
const tagline = "save yourself this time";
const description =
  "a map of everyone still holding on. you don't have to fix it tonight. you just have to stay.";

export const viewport: Viewport = {
  themeColor: "#070b14",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: tabTitle, template: `%s · ${tabTitle}` },
  description,
  applicationName: tabTitle,
  keywords: [
    "anonymous stories",
    "mental health",
    "depression support",
    "save yourself this time",
    "holding on",
  ],
  openGraph: {
    type: "website",
    title: tagline,
    description,
    locale: "en_US",
    siteName: tagline,
  },
  twitter: {
    card: "summary_large_image",
    title: tagline,
    description,
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${lora.variable} ${nunito.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
