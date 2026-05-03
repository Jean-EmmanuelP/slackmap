import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

// Inter: the SaaS canon (Stripe, Linear, Vercel, Notion). Inspires trust, reads
// crisp at every size, broad multilingual coverage.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

// JetBrains Mono: technical/reliable feel for code, IDs, slugs.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

// Instrument Serif kept for editorial display (hero/section headlines).
const instrumentSerif = Instrument_Serif({
  variable: "--font-serif",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Slackmap — Your company brain, extracted from your stack",
  description:
    "Connect Slack, Freshdesk, and more. Get an executable skills file your AI agents can actually run.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full flex flex-col font-[var(--font-sans)]"
        style={{ fontFeatureSettings: '"cv02", "cv03", "cv04", "cv11"' }}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
