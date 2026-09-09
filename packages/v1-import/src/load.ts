import type { V1LolRow } from "@mike-bot/v1-export";

import { v1LolRowSchema } from "@mike-bot/v1-export";

function parseRowAt(item: unknown, index: number): V1LolRow {
  const parsed = v1LolRowSchema.safeParse(item);
  if (!parsed.success) {
    throw new Error(`Invalid v1 row at ${String(index)}`);
  }
  return parsed.data;
}

function parseImportRows(raw: unknown): V1LolRow[] {
  if (!Array.isArray(raw)) {
    throw new TypeError("v1 JSON must be an array of lol rows");
  }
  return raw.map((item, index) => parseRowAt(item, index));
}

export { parseImportRows };
