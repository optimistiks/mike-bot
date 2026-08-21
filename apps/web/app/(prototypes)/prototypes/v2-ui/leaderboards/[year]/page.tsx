import { LeaderboardsPage } from "../../_components/leaderboards-page";

export default async function YearLeaderboardsPrototypePage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year } = await params;

  return <LeaderboardsPage title={`Сезон ${year} · весь год`} />;
}
