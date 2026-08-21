import { LeaderboardsPage } from "../../../_components/leaderboards-page";

export default async function MonthLeaderboardsPrototypePage({
  params,
}: {
  params: Promise<{ year: string; month: string }>;
}) {
  const { year, month } = await params;

  return <LeaderboardsPage title={`Сезон ${month}.${year}`} />;
}
