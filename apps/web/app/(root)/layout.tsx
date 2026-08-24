import type { Metadata, Viewport } from "next";
import { Press_Start_2P } from "next/font/google";
import { Suspense } from "react";

import "./globals.css";
import "./arcade.css";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { CrtBoot } from "./_components/crt-boot";
import { MiniAppQueryProvider } from "./_components/query-provider";
import { SeasonGlitch } from "./_components/season-glitch";
import { TelegramProvider } from "./_components/telegram-provider";

const font = Press_Start_2P({
  weight: "400",
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--font-press-start",
});

export const metadata: Metadata = {
  title: {
    default: "Mike-bot",
    template: "%s · Mike-bot",
  },
  description: "Telegram scoring Mini App",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#100c18",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${font.variable} antialiased dark`}>
      <body className={font.className}>
        <MiniAppQueryProvider>
          <TelegramProvider>
            <div className="arcade">
              {children}
              {/* Reads the pathname to notice a Season change, so it suspends
                  while the shell is built for a route whose params are still
                  unknown. It draws nothing until the second Season anyway. */}
              <Suspense fallback={null}>
                <SeasonGlitch />
              </Suspense>
              <CrtBoot />
            </div>
          </TelegramProvider>
        </MiniAppQueryProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
