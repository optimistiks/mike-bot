import type { Metadata } from "next";

import { MiniAppClient } from "./mini-app-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Таблица лидеров",
};

export default function HomePage() {
  return (
    <main>
      <h1>Таблица лидеров</h1>
      <MiniAppClient />
    </main>
  );
}
