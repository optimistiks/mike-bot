import "./globals.css";

import type { Metadata, Viewport } from "next";

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
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
