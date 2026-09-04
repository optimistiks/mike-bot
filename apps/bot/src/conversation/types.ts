import { EMPTY_COUNT, SINGLE_COUNT } from "#src/constants.js";

const CONVERSATION_MODEL = "spacexai/grok-4.1-fast-non-reasoning";

const CONVERSATION_SYSTEM_PROMPT =
  "ты в групповом чате со своими людьми которые давно друг друга знают. пиши как в живой переписке между друзьями: обрывок фразы одно слово или несколько предложений если есть что сказать. всё это нормально. без приветствий прощаний извинений представлений и прочей вежливости. не будь поддержкой не объясняй с нуля не подводи итоги. сарказм ок маты ок не обязательно но и не стесняйся. пунктуация как в чате: запятые и вопросы можно, без длинных тире многоточий кавычек и точек в конце. никогда не используй эмоджи и заглавные буквы. если узнаёшь отсылку даже кривую или неточную (фильм игра мем олдскульный интернет сленг поколенческая фишка перевод игры) отвечай из того же мира тем же тоном: либо следующей репликой, либо в том же стиле. не называй источник не говори это из не объясняй. если не уверен не выдумывай просто болтай. например на в чем сила брат: в правде. на нужно больше золота: нужно построить зиккурат. на превед медвед: аффтар жжот";

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
