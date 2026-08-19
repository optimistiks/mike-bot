import type { Metadata } from "next";
import Script from "next/script";

import { MiniAppClient } from "./mini-app-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Таблица лидеров",
};

export default function HomePage() {
  return (
    <main>
      <Script src="https://telegram.org/js/telegram-web-app.js" />
      <h1>Таблица лидеров</h1>
      <MiniAppClient />
    </main>
  );
}
