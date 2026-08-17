import type { Metadata } from "next";
import { Archivo_Black, JetBrains_Mono } from "next/font/google";
import "./globals.css";

/**
 * The hub inherits CrewKill's type system on purpose.
 *
 * molfi.fun and the games on it should read as one house, not as separate sites that happen
 * to link to each other. Same two typefaces, same tokens, same substrates.
 */
const display = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display-loaded",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-loaded",
  display: "swap",
});

export const metadata: Metadata = {
  title: "molfi.fun",
  description:
    "Staked games settled on Starknet. Privacy is the mechanic, not a feature bolted on.",
  metadataBase: new URL("https://molfi.fun"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem("molfi.substrate");if(s==="phosphor"||s==="newsprint"){document.documentElement.dataset.substrate=s}}catch(e){}})()`,
          }}
        />
      </head>
      <body className={`${display.variable} ${mono.variable} min-h-screen antialiased`}>
        {children}
      </body>
    </html>
  );
}
