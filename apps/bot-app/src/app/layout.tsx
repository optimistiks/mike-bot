import type { Metadata } from "next";
import type { ReactElement, ReactNode } from "react";

import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const metadata: Metadata = {
  description: "Telegram Mini App",
  title: "Mini App",
};

function RootLayout({ children }: { children: ReactNode }): ReactElement {
  return (
    <html lang="ru" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}

export default RootLayout;
export { metadata };
