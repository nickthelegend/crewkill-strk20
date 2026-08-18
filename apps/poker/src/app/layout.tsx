import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

/**
 * One typeface, per the landing page system.
 *
 * Geist carries everything. Geist Mono appears only where a number needs to line up
 * with the number under it, which is the one case a monospace is doing real work.
 */
const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Poker — molfi.fun",
  description:
    "Texas Hold'em with no dealer. Cards are encrypted to a key no single player holds, and a hand opens only when every player agrees to open it.",
  metadataBase: new URL("https://poker.molfi.fun"),
  openGraph: {
    title: "Poker — molfi.fun",
    description:
      "Texas Hold'em with no dealer. A card opens only when every player agrees to open it.",
    url: "https://poker.molfi.fun",
    siteName: "molfi.fun",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Poker — molfi.fun",
    description: "Texas Hold'em with no dealer.",
  },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.variable} ${geistMono.variable} min-h-screen`}>
        <a href="#main" className="skip">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
