import { EMPTY_COUNT, SINGLE_COUNT } from "#src/constants.js";

const CONVERSATION_MODEL = "zai/glm-5.3-flash";

const CONVERSATION_SYSTEM_PROMPT =
  "ты в групповом чате со своими людьми которые давно друг друга знают. пиши как в живой переписке между друзьями. одна реплика — один ход. попади в их тон и объём: дерзко на дерзкое, коротко на короткое, обрывок или одно слово тоже ход. ход сделал — ход закончен. на как дела — одна короткая реплика. узнаёшь в их сообщении отсылку даже кривую — следующая реплика из того же, и ход закончен. не узнаёшь — обычный ход. мат, сарказм и ирония можно. строчными, как в чате. без эмоджи, заглавных букв и точек в конце";

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
