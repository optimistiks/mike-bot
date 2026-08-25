"use client";

import { useState } from "react";

import { Button } from "@/components/ui/8bit/button";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/8bit/toggle-group";
import { reactionDisplayLabel, reactionKeyEmoji } from "@/lib/bot/reaction-key";
import type { ChatReactionView } from "@/lib/bot/scoring-reactions-schema";
import type { MarkType } from "@/lib/domain/mark";

/** The three Marks, in the order the Chat reads them. */
const MARKS: { type: MarkType; title: string }[] = [
  { type: "karma.plus", title: "Карма +" },
  { type: "karma.minus", title: "Карма −" },
  { type: "humor.add", title: "Юмор" },
];

export type ChatBindings = ReadonlyMap<string, MarkType | null>;

function toBindings(reactions: readonly ChatReactionView[]): ChatBindings {
  return new Map(
    reactions.map((reaction) => [reaction.reactionKey, reaction.markType]),
  );
}

/** What a reaction is called on screen: its own emoji, or a custom one's stand-in. */
function reactionFace(reaction: ChatReactionView): string {
  return reactionDisplayLabel(reaction.reactionKey, reaction.label, "?");
}

/**
 * A custom reaction only ever shows its stand-in emoji, which is often some
 * other reaction's face. Without a mark, two tiles that score differently look
 * identical.
 */
function isCustomReaction(reaction: ChatReactionView): boolean {
  return reactionKeyEmoji(reaction.reactionKey) === null;
}

export function ScoringReactionsEditor({
  reactions,
  canEdit,
  isSaving,
  error,
  onSave,
}: {
  reactions: readonly ChatReactionView[];
  canEdit: boolean;
  isSaving: boolean;
  error: string | null;
  onSave: (bindings: ChatBindings) => void;
}) {
  // Seeded once: the route renders this only after the palette has loaded, and
  // the tiles come from `reactions` either way, so a reaction missing from the
  // map simply reads as bound to nothing — which it is.
  const [bindings, setBindings] = useState(() => toBindings(reactions));

  /**
   * Bind these reactions to this Mark, and only this Mark.
   *
   * The map is keyed by reaction, so writing one here erases whatever it was
   * bound to before. Selecting 🤣 under Karma plus removes it from Humor with
   * no rule saying so — the same shape the primary key gives the table.
   */
  function bind(markType: MarkType, keys: string[]): void {
    const next = new Map(bindings);
    const selected = new Set(keys);

    for (const key of next.keys()) {
      if (selected.has(key)) {
        next.set(key, markType);
      } else if (next.get(key) === markType) {
        next.set(key, null);
      }
    }

    setBindings(next);
  }

  return (
    <div className="flex flex-col gap-6">
      {MARKS.map((mark) => {
        const selected = reactions
          .map((reaction) => reaction.reactionKey)
          .filter((key) => bindings.get(key) === mark.type);

        return (
          <section key={mark.type} className="flex flex-col gap-2">
            <h2 className="arcade-label">{mark.title}</h2>
            <ToggleGroup
              aria-label={mark.title}
              multiple
              value={selected}
              onValueChange={(value) => {
                bind(mark.type, value);
              }}
              className="flex-wrap"
              disabled={!canEdit || isSaving}
            >
              {reactions.map((reaction) => (
                <ToggleGroupItem
                  key={reaction.reactionKey}
                  value={reaction.reactionKey}
                  variant="outline"
                  aria-label={`${reactionFace(reaction)}${
                    isCustomReaction(reaction) ? " (своя)" : ""
                  } — ${mark.title}`}
                >
                  {reactionFace(reaction)}
                  {isCustomReaction(reaction) ? (
                    <span
                      aria-hidden="true"
                      className="arcade-caption absolute -top-1 -right-1 leading-none"
                    >
                      •
                    </span>
                  ) : null}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </section>
        );
      })}

      <p className="arcade-caption">
        Чтобы добавить свою реакцию, отправьте в группе /addreaction и эмодзи.
      </p>

      {error ? <p className="arcade-caption">{error}</p> : null}

      {canEdit ? (
        <Button
          variant="outline"
          className="arcade-label"
          disabled={isSaving}
          onClick={() => {
            onSave(bindings);
          }}
        >
          {isSaving ? "сохраняю…" : "сохранить"}
        </Button>
      ) : (
        <p className="arcade-caption">
          Менять реакции могут только администраторы группы.
        </p>
      )}
    </div>
  );
}
