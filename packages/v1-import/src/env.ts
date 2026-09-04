// eslint-disable-next-line node/no-process-env -- env.ts is the process.env seam
const processEnv: NodeJS.ProcessEnv = process.env;

function readEnv(name: string): string | undefined {
  return processEnv[name];
}

function trimmedOrUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed === "") {
    return undefined;
  }
  return trimmed;
}

function nonempty(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return trimmedOrUndefined(value);
}

function unpooledDatabaseUrl(): string {
  return nonempty(readEnv("DATABASE_URL_UNPOOLED")) ?? nonempty(readEnv("DATABASE_URL")) ?? "";
}

function importJsonPath(): string | undefined {
  return nonempty(readEnv("IMPORT_JSON"));
}

export { importJsonPath, unpooledDatabaseUrl };
