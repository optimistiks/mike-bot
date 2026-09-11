import type { Tool } from "ai";

import { tool } from "ai";
import { z } from "zod";

import { exaApiKey } from "#src/env.js";

import { readToolJson, reportToolFailure } from "./observability.js";

const EXA_CONTENTS_URL = "https://api.exa.ai/contents";
const URL_COUNT = 3;
const HTTP_PROTOCOLS = new Set(["http:", "https:"]);

const exaPageSchema = z.object({
  text: z.string().optional(),
  title: z.string().optional(),
  url: z.string(),
});

const exaResponseSchema = z.object({
  results: z.array(exaPageSchema).optional(),
});

interface ContentsPage {
  text: string;
  title: string;
  url: string;
}

interface ContentsOk {
  ok: true;
  results: ContentsPage[];
}

interface ContentsMiss {
  error: string;
  ok: false;
}

type ContentsLookup = ContentsOk | ContentsMiss;

interface LookupContentsInput {
  apiKey: string | undefined;
  signal?: AbortSignal;
  urls: readonly string[];
}

type JsonRead = { data: unknown; ok: true } | ContentsMiss;

function fail(error: string): ContentsMiss {
  return { error, ok: false };
}

function asHttpUrl(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (!HTTP_PROTOCOLS.has(parsed.protocol)) {
      return null;
    }
    return trimmed;
  } catch {
    return null;
  }
}

function usableUrls(urls: readonly string[]): string[] {
  const seen = new Set<string>();
  const usable: string[] = [];
  for (const value of urls) {
    const href = asHttpUrl(value);
    if (href !== null && !seen.has(href) && usable.length < URL_COUNT) {
      seen.add(href);
      usable.push(href);
    }
  }
  return usable;
}

function asPage(page: z.infer<typeof exaPageSchema>): ContentsPage | null {
  const url = page.url.trim();
  const text = page.text?.trim() ?? "";
  if (url === "" || text === "") {
    return null;
  }
  return {
    text,
    title: page.title?.trim() ?? "",
    url,
  };
}

function readJson(
  signal: AbortSignal | undefined,
  apiKey: string,
  urls: readonly string[],
): Promise<JsonRead> {
  return readToolJson("contents", "страница недоступна", () =>
    fetch(EXA_CONTENTS_URL, {
      body: JSON.stringify({ text: true, urls }),
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
      },
      method: "POST",
      signal,
    }),
  );
}

function pagesFromData(data: unknown): ContentsPage[] | null {
  const parsed = exaResponseSchema.safeParse(data);
  if (!parsed.success) {
    reportToolFailure({ cause: parsed.error, kind: "parse", tool: "contents" });
    return null;
  }
  const pages: ContentsPage[] = [];
  for (const result of parsed.data.results ?? []) {
    const page = asPage(result);
    if (page !== null) {
      pages.push(page);
    }
  }
  return pages;
}

async function lookupContents(input: LookupContentsInput): Promise<ContentsLookup> {
  if (input.apiKey === undefined || input.apiKey === "") {
    reportToolFailure({ kind: "config", tool: "contents" });
    return fail("страница недоступна");
  }
  const urls = usableUrls(input.urls);
  if (urls.length === 0) {
    return fail("страница недоступна");
  }
  const read = await readJson(input.signal, input.apiKey, urls);
  if (!read.ok) {
    return read;
  }
  const pages = pagesFromData(read.data);
  if (pages === null) {
    return fail("страница недоступна");
  }
  if (pages.length === 0) {
    return fail("ничего не нашлось");
  }
  return { ok: true, results: pages };
}

const contentsInputSchema = z.object({
  urls: z
    .array(z.string())
    .describe(
      "До трёх http(s) ссылок из этой реплики или из сообщения члена чата, на которое это ответ. Не бери ссылки из других старых реплик и не бери ссылки бота.",
    ),
});

function contentsTool(): Tool {
  return tool({
    description: [
      "Чтение страницы по известной ссылке.",
      "Вызывай только если есть http(s) ссылка в этой реплике или в сообщении члена чата, на которое это ответ, и собеседник просит глянуть: глянь, посмотри, прочитай, что там, чекни.",
      "Не вызывай просто потому что ссылка есть.",
      "Не вызывай из-за ссылок в других старых репликах и не по ссылкам бота.",
      "За реплику вызывай не больше одного раза.",
      "В urls положи сами ссылки, не текст вокруг.",
      "Ссылки в текст ответа не вставляй.",
      "Если ok false — скажи своими словами что не нашёл или что сеть лежит.",
    ].join(" "),
    execute: ({ urls }, { abortSignal }) =>
      lookupContents({ apiKey: exaApiKey(), signal: abortSignal, urls }),
    inputSchema: contentsInputSchema,
  });
}

export type { ContentsLookup, LookupContentsInput };
export { contentsTool, lookupContents };
