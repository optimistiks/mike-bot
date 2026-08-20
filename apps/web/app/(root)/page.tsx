import type { Metadata } from "next";

import { MiniAppClient } from "./mini-app-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Таблица лидеров",
};

interface HomePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  let developmentInitDataRaw: string | null | undefined;

  if (process.env.NODE_ENV !== "production") {
    const { persona } = await searchParams;
    const personaName = typeof persona === "string" ? persona : undefined;
    const { signDevelopmentInitDataForPersona } =
      await import("@/lib/mini-app/development-init-data.server");
    developmentInitDataRaw = signDevelopmentInitDataForPersona(personaName);
  }

  return (
    <main>
      <h1>Таблица лидеров</h1>
      <MiniAppClient developmentInitDataRaw={developmentInitDataRaw} />
    </main>
  );
}
