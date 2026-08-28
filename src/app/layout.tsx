import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { ThemeScript } from "@/components/theme/theme-script";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz", "SOFT"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Lunova — meet people through how you live",
    template: "%s · Lunova",
  },
  description:
    "Lunova helps you discover meaningful connections through who you are, what you enjoy, what you listen to, and how you live.",
  applicationName: "Lunova",
  openGraph: {
    title: "Lunova",
    description: "Meet people through how you live.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  // Required for env(safe-area-inset-*) to report anything but 0 — without it
  // the bottom nav sits under the home indicator on every notched phone.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf6f1" },
    { media: "(prefers-color-scheme: dark)", color: "#161219" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // Only `en` ships today, so the document language is static. When a second
  // locale lands, make this async and read `resolveLocale()` from `@/lib/i18n/locale`
  // (that turns the marketing pages dynamic — an acceptable trade at that point).
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${fraunces.variable} h-full`}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
