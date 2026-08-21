import Link from "next/link";

import {
  leaderboardHref,
  MONTH_SHORT_NAMES,
  pickableYears,
  type PrototypeSeason,
} from "../_lib/seasons";

/**
 * A bare Season index. Ticket 05 replaces it with the drawer; what matters here
 * is that every Season is addressable and that changing Season **replaces**
 * rather than pushes, so back always means "return to the Chat list" instead of
 * walking backwards through every Season the Member looked at.
 */
export function SeasonLinks({
  chatId,
  season,
}: {
  chatId: number;
  season: PrototypeSeason;
}) {
  return (
    <nav aria-label="Сезон" className="flex flex-col gap-2">
      {pickableYears().map((year) => (
        <div key={year} className="flex flex-wrap items-center gap-2">
          <Link
            replace
            href={leaderboardHref(chatId, { year })}
            className="arcade-text-xs text-primary"
          >
            {year}
          </Link>
          {MONTH_SHORT_NAMES.map((name, index) => (
            <Link
              key={name}
              replace
              href={leaderboardHref(chatId, { year, month: index + 1 })}
              className={
                season.year === year && season.month === index + 1
                  ? "arcade-text-xs text-secondary"
                  : "arcade-text-xs text-muted-foreground"
              }
            >
              {name}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
