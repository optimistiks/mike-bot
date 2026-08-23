import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/8bit/empty";

import type { LeaderboardSection } from "../_lib/leaderboard-shape";

/**
 * What one section with no entries looks like.
 *
 * A Season can be busy and still leave a section empty — Юмористы full while
 * Уважаемые люди has nobody in it — and the filmstrip has to keep its five
 * slides either way, or swiping lands on nothing. So the emptiness is stated on
 * the slide rather than skipped.
 *
 * The copy is per section because "empty" means something different in each
 * one: the receiving sections are waiting for a mark, the giving sections are
 * waiting for someone to hand one out, and an empty Как же у них горит is good
 * news. Each says which mark fills it, so the slide doubles as the one place
 * the scoring rules are spelled out.
 */
const SECTION_COPY: Record<string, { media: string; description: string }> = {
  "karma-received": {
    media: "👍",
    description: "Пока никто не получил ни одного 👍 или «+».",
  },
  "humor-received": {
    media: "🤣",
    description: "Пока никто никого не рассмешил — ни одного 🤣 или «лол».",
  },
  "karma-plus-given": {
    media: "🫱",
    description: "Пока никто не раздавал 👍 и «+». Щедрость свободна.",
  },
  "humor-given": {
    media: "😐",
    description: "Пока никто не смеялся: ни одного 🤣, ни одного «лол».",
  },
  "karma-minus-given": {
    media: "🕊️",
    description: "Ни одного 👎 и ни одного «-». Всё спокойно.",
  },
};

const FALLBACK_COPY = {
  media: "👾",
  description: "Здесь пока пусто.",
};

export function SectionEmpty({ section }: { section: LeaderboardSection }) {
  const copy = SECTION_COPY[section.id] ?? FALLBACK_COPY;

  return (
    <Empty className="arcade-empty">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="arcade-empty-media">
          <span aria-hidden="true">{copy.media}</span>
        </EmptyMedia>
        <EmptyTitle className="arcade-h2">ПУСТО</EmptyTitle>
        <EmptyDescription className="arcade-caption">
          {copy.description}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
