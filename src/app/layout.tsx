import { getPublicSiteUrl } from "@/lib/site-url";
import type { Metadata, Viewport } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f2f1ef",
};

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin", "latin-ext"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

const siteUrl = getPublicSiteUrl();
const siteDescription =
  "Screen sites, manage grid connection processes and monitor published grid changes across your energy development portfolio.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "NOXHEIM — Grid Development Intelligence",
    template: "%s · NOXHEIM",
  },
  description: siteDescription,
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "NOXHEIM — Grid Development Intelligence",
    description: siteDescription,
    type: "website",
    locale: "en_GB",
    siteName: "NOXHEIM",
    url: siteUrl,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${instrumentSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-canvas font-sans text-ink">{children}</body>
    </html>
  );
}
