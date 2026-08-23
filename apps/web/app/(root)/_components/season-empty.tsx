import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/8bit/empty";

import type { LeaderboardPeriod } from "@/lib/leaderboard/schema";

import { periodLabel } from "../_lib/periods";

/**
 * What a Season with no Events looks like.
 *
 * One clear statement rather than five blank sections: a Member who lands here
 * should understand there is nothing to see, not assume the app broke. The
 * header stays above it, so the Season chip is still there to leave by.
 */
export function SeasonEmpty({ period }: { period: LeaderboardPeriod }) {
  return (
    <Empty className="arcade-empty">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="arcade-empty-media">
          <span aria-hidden="true">👾</span>
        </EmptyMedia>
        <EmptyTitle className="arcade-h2">НЕТ ДАННЫХ</EmptyTitle>
        <EmptyDescription className="arcade-caption">
          {periodLabel(period)} — здесь пока ничего не происходило.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
