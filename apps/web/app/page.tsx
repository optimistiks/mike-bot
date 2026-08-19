import type { Metadata } from 'next';

import { getRuntimeDb } from '@/lib/db/runtime';
import { queryLeaderboard } from '@/lib/leaderboard/query';
import { FIXTURE_CHAT_ID, seedLeaderboardFixture } from '@/lib/leaderboard/seed';
import { getCurrentSeason } from '@/lib/scoring';

import { LeaderboardSections } from './leaderboard-sections';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Таблица лидеров',
};

export default async function HomePage() {
  const db = await getRuntimeDb();
  await seedLeaderboardFixture(db);

  const leaderboard = await queryLeaderboard(
    db,
    FIXTURE_CHAT_ID,
    getCurrentSeason(),
  );

  return (
    <main>
      <h1>Таблица лидеров</h1>
      <p className="hint">Тестовый чат — выбор чата появится позже.</p>
      <LeaderboardSections leaderboard={leaderboard} />
    </main>
  );
}
