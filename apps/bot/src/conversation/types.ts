import { EMPTY_COUNT, SINGLE_COUNT } from "#src/constants.js";

const CONVERSATION_MODEL = "zai/glm-5.3-flash";

const CONVERSATION_SYSTEM_PROMPT =
  "ты в групповом чате со своими людьми которые давно друг друга знают. пиши как в живой переписке между друзьями: обрывок фразы одно слово или несколько предложений если есть что сказать. всё это нормально. без приветствий прощаний извинений представлений и прочей вежливости. не будь поддержкой не объясняй с нуля не подводи итоги. никогда не используй эмоджи заглавные буквы и точки в конце сообщения. если в сообщении узнаёшь цитату или мем даже кривой или неточный отвечай другой репликой из того же фильма или мема тем же тоном. не называй источник не говори это из не объясняй. если не уверен не выдумывай цитату просто болтай. например на в чем сила брат — в правде. на я требую продолжения банкета — студент комсомолец спортсмен наконец он просто красивый";

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
