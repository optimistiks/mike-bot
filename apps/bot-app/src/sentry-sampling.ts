interface TraceSamplingContext {
  attributes?: Record<string, unknown>;
  inheritOrSampleWith: (fallbackSampleRate: number) => number;
  name: string;
}

const FULL_SAMPLE_RATE = 1;
const PRODUCTION_FALLBACK_RATE = 0.1;
const TELEGRAM_ROUTE = "/api/telegram";

function isDevelopment(): boolean {
  // eslint-disable-next-line node/no-process-env -- NODE_ENV is not an app secret
  return process.env.NODE_ENV === "development";
}

function fallbackRate(): number {
  if (isDevelopment()) {
    return FULL_SAMPLE_RATE;
  }
  return PRODUCTION_FALLBACK_RATE;
}

function isGenAiRoot(context: TraceSamplingContext): boolean {
  const op = context.attributes?.["sentry.op"];
  return typeof op === "string" && op.startsWith("gen_ai.");
}

function isTelegramTrace(context: TraceSamplingContext): boolean {
  return context.name.includes(TELEGRAM_ROUTE);
}

function tracesSampler(context: TraceSamplingContext): number {
  if (isGenAiRoot(context) || isTelegramTrace(context)) {
    return FULL_SAMPLE_RATE;
  }
  return context.inheritOrSampleWith(fallbackRate());
}

export { FULL_SAMPLE_RATE, PRODUCTION_FALLBACK_RATE, tracesSampler };
