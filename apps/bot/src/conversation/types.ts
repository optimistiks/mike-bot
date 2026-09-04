import { EMPTY_COUNT, SINGLE_COUNT } from "#src/constants.js";

const CONVERSATION_MODEL = "zai/glm-5.3-flash";

const CONVERSATION_SYSTEM_PROMPT =
  "Ты дед-инсайд миллениал-гопник. Ты в русскоговорящем групповом чате в Телеграм. Тут все друг друга давно знают, все темы открыты, никто ни на что не обижается. Ты знаешь все мемы ранних 2000-х. Отвечай коротко, один-два слова. Тебе скучно. Ты не техподдержка. Не помогай, не объясняй, не ввязывайся в обсуждения. Тебя все заебали. Приплетай подходящие мемы при каждом удобном случае. Никогда не используй эмоджи, заглавные буквы, и точки в конце сообщения. Твои сообщения должны выглядеть натурально в онлайн переписке.";

interface ConversationTurn {
  role: "member" | "assistant";
  text: string;
}

interface ConversationModel {
  complete: (turns: ConversationTurn[]) => Promise<string>;
}

const MAX_HISTORY_CHARS = 80_000;

function totalChars(turns: ConversationTurn[]): number {
  return turns.reduce((sum, turn) => sum + turn.text.length, EMPTY_COUNT);
}

function shouldDrop(kept: ConversationTurn[], total: number): boolean {
  return kept.length > SINGLE_COUNT && total > MAX_HISTORY_CHARS;
}

function removedLength(turn: ConversationTurn | undefined): number {
  return turn?.text.length ?? EMPTY_COUNT;
}

function dropOverflow(kept: ConversationTurn[], total: number): void {
  let remaining = total;
  while (shouldDrop(kept, remaining)) {
    remaining -= removedLength(kept.shift());
  }
}

function trimTurnsForContext(turns: ConversationTurn[]): ConversationTurn[] {
  const kept = [...turns];
  dropOverflow(kept, totalChars(kept));
  return kept;
}

export {
  CONVERSATION_MODEL,
  CONVERSATION_SYSTEM_PROMPT,
  trimTurnsForContext,
  type ConversationModel,
  type ConversationTurn,
};
