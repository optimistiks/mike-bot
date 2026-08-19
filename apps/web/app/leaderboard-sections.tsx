import type { LeaderboardResponse } from '@/lib/leaderboard/schema';

type LeaderboardSectionsProps = {
  leaderboard: LeaderboardResponse;
};

export function LeaderboardSections({ leaderboard }: LeaderboardSectionsProps) {
  return (
    <div className="leaderboard">
      <p className="season-label">
        Сезон {leaderboard.season.year}-
        {String(leaderboard.season.month).padStart(2, '0')}
        {leaderboard.isCurrentSeason ? ' · текущий сезон' : ''}
      </p>

      {leaderboard.sections.map((section) => (
        <section key={section.id} className="leaderboard-section">
          <h2>{section.title}</h2>
          {section.entries.length === 0 ? (
            <p className="empty">Пока пусто</p>
          ) : (
            <ol>
              {section.entries.map((entry) => (
                <li key={entry.userId}>
                  <span className="name">{entry.displayName}</span>
                  <span className="score">{entry.score}</span>
                  {entry.isCrown ? <span aria-label="crown"> 👑</span> : null}
                  {entry.isChicken ? (
                    <span aria-label="chicken"> 🐔</span>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </section>
      ))}
    </div>
  );
}
