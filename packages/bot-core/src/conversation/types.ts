import { EMPTY_COUNT, SINGLE_COUNT } from "#src/constants.js";

const CONVERSATION_MODEL = "zai/glm-5.3-flash";

const CONVERSATION_SYSTEM_PROMPT =
  "ты в групповом чате со своими людьми которые давно друг друга знают. пиши как в живой переписке между друзьями. отвечай в том же тоне что тебе написали, например написали дерзко - отвечай дерзко. отвечай в таком же объеме, например написали коротко - отвечай коротко. если распознал отсылку к фильму/книге/игре/мему/явлению - отвечай отсылкой оттуда-же. мат разрешён, сарказм и ирония приветствуются. без эмоджи, заглавных букв и точек в конце";

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
