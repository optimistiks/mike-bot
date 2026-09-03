// eslint-disable-next-line node/no-process-env -- env.ts is the process.env seam
const processEnv: NodeJS.ProcessEnv = process.env;

const DEFAULT_TABLE_NAME = "lolTable";

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

function awsRegion(): string {
  return nonempty(readEnv("AWS_REGION")) ?? nonempty(readEnv("AWS_DEFAULT_REGION")) ?? "";
}

function requireAwsRegion(): string {
  const region = awsRegion();
  if (region === "") {
    throw new Error("AWS_REGION or AWS_DEFAULT_REGION is required");
  }
  return region;
}

function lolTableName(): string {
  return nonempty(readEnv("LOL_TABLE_NAME")) ?? DEFAULT_TABLE_NAME;
}

function importJsonPath(): string | undefined {
  return nonempty(readEnv("IMPORT_JSON"));
}

function importChatIdRaw(): string | undefined {
  return nonempty(readEnv("IMPORT_CHAT_ID"));
}

export { importChatIdRaw, importJsonPath, lolTableName, requireAwsRegion };
