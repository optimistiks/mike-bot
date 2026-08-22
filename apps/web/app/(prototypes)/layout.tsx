import "../(root)/globals.css";

import type { Metadata, Viewport } from "next";
import { Press_Start_2P } from "next/font/google";

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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${font.variable} antialiased dark`}>
      <body className={font.className}>{children}</body>
    </html>
  );
}
