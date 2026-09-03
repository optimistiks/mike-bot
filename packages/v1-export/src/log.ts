function logError(message: string, extra?: unknown): void {
  // eslint-disable-next-line no-console -- log.ts is the console seam
  console.error(message, extra);
}

function logInfo(message: string): void {
  // eslint-disable-next-line no-console -- log.ts is the console seam
  console.log(message);
}

function logWarn(message: string, extra: unknown): void {
  // eslint-disable-next-line no-console -- log.ts is the console seam
  console.warn(message, extra);
}

export { logError, logInfo, logWarn };
