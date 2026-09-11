import type { Tool } from "ai";
import type { MessageEntity } from "grammy/types";

import { tool } from "ai";
import { z } from "zod";

import { exaApiKey } from "#src/env.js";

import { readToolJson, reportToolFailure } from "./observability.js";

const EXA_SEARCH_URL = "https://api.exa.ai/search";
const FOOTER_PREFIX = "ссылки: ";
const LINK_COUNT = 3;
const MAX_AGE_HOURS = 24;
const MOSCOW_TIME_ZONE = "Europe/Moscow";

const exaHitSchema = z.object({
  highlights: z.array(z.string()).optional(),
  title: z.string().optional(),
  url: z.string(),
});

const exaResponseSchema = z.object({
  results: z.array(exaHitSchema).optional(),
});

interface SearchHit {
  highlights: string[];
  title: string;
  url: string;
}

interface SearchOk {
  ok: true;
  results: SearchHit[];
}

interface SearchMiss {
  error: string;
  ok: false;
}

type SearchLookup = SearchOk | SearchMiss;

interface LookupSearchInput {
  apiKey: string | undefined;
  query: string;
  signal?: AbortSignal;
}

interface SearchReply {
  entities: MessageEntity[];
  linkPreviewDisabled: true;
  text: string;
}

type JsonRead = { data: unknown; ok: true } | SearchMiss;

function fail(error: string): SearchMiss {
  return { error, ok: false };
}

function calendarDateInMoscow(at: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: MOSCOW_TIME_ZONE,
    year: "numeric",
  }).formatToParts(at);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (year === undefined || month === undefined || day === undefined) {
    return "";
  }
  return `${year}-${month}-${day}`;
}

function asHit(hit: z.infer<typeof exaHitSchema>): SearchHit | null {
  const url = hit.url.trim();
  if (url === "") {
    return null;
  }
  return {
    highlights: hit.highlights ?? [],
    title: hit.title?.trim() ?? "",
    url,
  };
}

function readJson(
  signal: AbortSignal | undefined,
  apiKey: string,
  query: string,
): Promise<JsonRead> {
  return readToolJson("search", "поиск недоступен", () =>
    fetch(EXA_SEARCH_URL, {
      body: JSON.stringify({
        contents: { highlights: true, maxAgeHours: MAX_AGE_HOURS },
        query,
        type: "auto",
      }),
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
      },
      method: "POST",
      signal,
    }),
  );
}

function hitsFromData(data: unknown): SearchHit[] | null {
  const parsed = exaResponseSchema.safeParse(data);
  if (!parsed.success) {
    reportToolFailure({ cause: parsed.error, kind: "parse", tool: "search" });
    return null;
  }
  const hits: SearchHit[] = [];
  for (const result of parsed.data.results ?? []) {
    const hit = asHit(result);
    if (hit !== null) {
      hits.push(hit);
    }
  }
  return hits;
}

async function lookupSearch(input: LookupSearchInput): Promise<SearchLookup> {
  const query = input.query.trim();
  if (input.apiKey === undefined || input.apiKey === "") {
    reportToolFailure({ kind: "config", tool: "search" });
    return fail("поиск недоступен");
  }
  if (query === "") {
    return fail("поиск недоступен");
  }
  const read = await readJson(input.signal, input.apiKey, query);
  if (!read.ok) {
    return read;
  }
  const hits = hitsFromData(read.data);
  if (hits === null) {
    return fail("поиск недоступен");
  }
  if (hits.length === 0) {
    return fail("ничего не нашлось");
  }
  return { ok: true, results: hits };
}

function isSearchOk(output: unknown): output is SearchOk {
  if (typeof output !== "object" || output === null) {
    return false;
  }
  return (
    "ok" in output && output.ok === true && "results" in output && Array.isArray(output.results)
  );
}

function searchHitsFromOutput(output: unknown): SearchHit[] {
  if (!isSearchOk(output)) {
    return [];
  }
  return output.results;
}

function linkLabel(hit: SearchHit): string {
  if (hit.title !== "") {
    return hit.title.replaceAll("\n", " ").trim();
  }
  try {
    return new URL(hit.url).hostname;
  } catch {
    return hit.url;
  }
}

function footerHits(hits: SearchHit[]): SearchHit[] {
  return hits.slice(0, LINK_COUNT);
}

function searchReply(recap: string, hits: SearchHit[]): SearchReply | null {
  const chosen = footerHits(hits);
  if (chosen.length === 0) {
    return null;
  }
  const labeled = chosen.map((hit) => ({ hit, label: linkLabel(hit) }));
  const footer = `${FOOTER_PREFIX}${labeled.map((entry) => entry.label).join(" ")}`;
  const text = recap === "" ? footer : `${recap}\n${footer}`;
  const footerStart = text.length - footer.length;
  let cursor = footerStart + FOOTER_PREFIX.length;
  const entities: MessageEntity[] = [];
  for (const entry of labeled) {
    entities.push({
      length: entry.label.length,
      offset: cursor,
      type: "text_link",
      url: entry.hit.url,
    });
    cursor += entry.label.length + 1;
  }
  return { entities, linkPreviewDisabled: true, text };
}

const searchInputSchema = z.object({
  query: z
    .string()
    .describe(
      "Поисковый запрос. Раскрой сленг (мск это Москва), поставь календарную дату и место, если они нужны. Пиши как запрос в поиск, не как реплику из чата.",
    ),
});

function searchTool(now: Date): Tool {
  const today = calendarDateInMoscow(now);
  return tool({
    description: [
      "Поиск в интернете.",
      `Сегодняшняя дата ${today}, часовой пояс Europe/Moscow.`,
      "Вызывай только если собеседник просит посмотреть в интернете: погугли, поищи, узнай, чекни, это правда, не выдумывай.",
      "Не вызывай на каждый вопрос про новости или афишу.",
      "За реплику вызывай не больше одного раза.",
      "В query поставь конкретную дату вместо вчера/сегодня/завтра: завтра это сегодня плюс один календарный день.",
      "Ссылки в текст ответа не вставляй.",
      "Если ok false — скажи своими словами что не нашёл или что сеть лежит.",
    ].join(" "),
    execute: ({ query }, { abortSignal }) =>
      lookupSearch({ apiKey: exaApiKey(), query, signal: abortSignal }),
    inputSchema: searchInputSchema,
  });
}

export type { SearchHit, SearchReply };
export { lookupSearch, searchHitsFromOutput, searchReply, searchTool };
