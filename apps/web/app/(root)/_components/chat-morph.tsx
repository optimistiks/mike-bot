import type { ReactElement } from "react";

import { ViewTransition } from "react";

import { chatMorphName } from "../_lib/chat";

/**
 * One end of the Chat card → Leaderboard header shared-element morph.
 *
 * Both ends have to spell the same three props or the morph silently stops
 * pairing: `share="morph"` names the transition so the stylesheet can reach it,
 * and `default="none"` stops the pair from cross-fading on every unrelated
 * transition — but `default="none"` without an explicit `share` kills the morph
 * outright. That subtlety is worth stating once rather than at both ends.
 */
export function ChatMorph({
  chatId,
  children,
}: {
  chatId: number;
  children: ReactElement;
}) {
  return (
    <ViewTransition name={chatMorphName(chatId)} share="morph" default="none">
      {children}
    </ViewTransition>
  );
}
