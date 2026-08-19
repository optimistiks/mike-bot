import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mike-bot',
  description: 'Telegram scoring Mini App',
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
