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

export const metadata: Metadata = {
  title: {
    default: "NOXHEIM — Grid Development Intelligence",
    template: "%s · NOXHEIM",
  },
  description:
    "Screen sites, manage grid connection processes and monitor grid changes across your energy development portfolio.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "NOXHEIM — Grid Development Intelligence",
    description:
      "Screen sites, manage grid connection processes and monitor grid changes across your energy development portfolio.",
    type: "website",
    locale: "en_GB",
    siteName: "NOXHEIM",
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
