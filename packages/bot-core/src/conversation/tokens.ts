import { scoringToken } from "#src/scoring/token.js";
import { isStopMessage, isWakeMessage } from "#src/telegram/text.js";

type SpecialToken = "scoring" | "stop" | "wake";

function scoringOrNull(text: string): SpecialToken | null {
  if (scoringToken(text) === null) {
    return null;
  }
  return "scoring";
}

function specialToken(text: string): SpecialToken | null {
  if (isWakeMessage(text)) {
    return "wake";
  }
  if (isStopMessage(text)) {
    return "stop";
  }
  return scoringOrNull(text);
}

export { specialToken, type SpecialToken };
