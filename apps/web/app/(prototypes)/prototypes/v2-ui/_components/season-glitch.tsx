"use client";

import { usePathname } from "next/navigation";

import { useChangeCounter } from "../_lib/use-change-counter";

/**
 * The Chat-scoped prefix of a Leaderboard URL, whatever Season follows it.
 *
 * The Chat id is signed. Telegram group ids are negative, and every id in the
 * prototype's fixtures is, so a pattern that only accepts digits matches no
 * real Leaderboard URL at all.
 */
const LEADERBOARD_PATH = /^\/prototypes\/v2-ui\/chats\/-?\d+\/leaderboards\//;

/** The `/chats/<id>/leaderboards` prefix a Leaderboard URL is scoped by. */
function leaderboardScope(path: string): string | undefined {
  return LEADERBOARD_PATH.exec(path)?.[0];
}

/**
 * Two Leaderboard URLs for the same Chat that differ is a Season change and
 * nothing else, because the Season is the only other thing in the URL. Moving
 * between two Chats is deliberately excluded: that is a different Leaderboard,
 * not a different Season of this one.
 */
function isSeasonChange(from: string, to: string): boolean {
  const scope = leaderboardScope(from);

  return from !== to && scope !== undefined && scope === leaderboardScope(to);
}

/**
 * The tracking-glitch wipe: a horizontal tear and a burst of static when the
 * Season changes, so a change of data is unmistakable rather than a silent
 * content swap.
 *
 * It watches the URL rather than being fired by the Season picker, because a
 * Season change replaces the route: the picker, the header it sits in, and the
 * whole Leaderboard screen all unmount before the new Season renders, so
 * nothing down there survives to notice that something changed. This component
 * lives in the prototype's layout, which does survive, and the URL is the one
 * piece of state that spans both sides of the navigation.
 *
 * Nothing here times the 350ms. The overlay is keyed by a counter, so a Season
 * change remounts it and CSS restarts from the top; both of its animations end
 * `forwards` on invisible, and the whole thing is `pointer-events: none`, so a
 * finished glitch left mounted is indistinguishable from no glitch. Timing the
 * teardown in JavaScript would only add a second clock that can disagree with
 * the animations' own.
 */
export function SeasonGlitch() {
  const pathname = usePathname();
  const playCount = useChangeCounter(pathname, isSeasonChange);

  if (playCount === 0) return null;

  return (
    <div key={playCount} className="arcade-glitch" aria-hidden="true">
      <div className="arcade-glitch-static" />
      <div className="arcade-glitch-band" />
    </div>
  );
}
