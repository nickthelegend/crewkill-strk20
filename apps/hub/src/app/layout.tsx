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
  title: "molfi.fun — staked games settled on Starknet",
  description:
    "Games where privacy is the mechanic, not a feature. Buy in privately, play, and settle onchain where anyone can check the result afterwards.",
  metadataBase: new URL("https://molfi.fun"),
  openGraph: {
    title: "molfi.fun",
    description:
      "Games where privacy is the mechanic, not a feature. Settled onchain, checkable afterwards.",
    url: "https://molfi.fun",
    siteName: "molfi.fun",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "molfi.fun",
    description: "Games where privacy is the mechanic, not a feature.",
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
