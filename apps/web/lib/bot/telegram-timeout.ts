import type { Api } from "grammy";

/** How long any Telegram lookup on a request path may hold that request open. */
export const TELEGRAM_TIMEOUT_MS = 3_000;

type GrammySignal = NonNullable<Parameters<Api["getChat"]>[1]>;

/**
 * An abort signal grammY will accept, bounding one Telegram call.
 *
 * grammY types its `signal` parameter with the bundled `abort-controller`
 * polyfill, which is structurally incompatible with the platform's own
 * `AbortSignal` even though it is the very thing grammY hands to `fetch` at
 * runtime. The cast is that disagreement and nothing more, so it lives here
 * once instead of at every call site.
 *
 * Every Telegram call made while a request is waiting must pass one of these.
 * An unbounded await on Telegram is what leaves the Mini App on its loading
 * state with nothing to show.
 */
export function telegramTimeout(
  ms: number = TELEGRAM_TIMEOUT_MS,
): GrammySignal {
  return AbortSignal.timeout(ms) as unknown as GrammySignal;
}
