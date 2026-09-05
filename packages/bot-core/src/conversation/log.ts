import { logInfo } from "#src/log.js";

function logCompletionAttempt(entry: {
  completion: string | null;
  filters: string[];
  prompt: unknown;
}): void {
  logInfo(JSON.stringify(entry));
}

export { logCompletionAttempt };
