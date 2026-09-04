function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function nonemptyString(value: unknown): string | undefined {
  if (typeof value === "string" && value !== "") {
    return value;
  }
  return undefined;
}

export { isRecord, nonemptyString };
