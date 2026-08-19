import path from "node:path";

const DEFAULT_PGLITE_DATA_DIR = ".data/pglite";

type Environment = Readonly<Record<string, string | undefined>>;

export type DatabaseSeedTarget =
  | { kind: "pglite"; dataDir: string }
  | { kind: "postgres"; databaseUrl: string };

export function resolveLocalPgliteDataDir(
  env: Environment = process.env,
  cwd = process.cwd(),
): string {
  const configured = env.PGLITE_DATA_DIR?.trim();
  return path.resolve(
    cwd,
    configured && configured.length > 0 ? configured : DEFAULT_PGLITE_DATA_DIR,
  );
}

export function resolveDatabaseSeedTarget(
  args: readonly string[],
  env: Environment = process.env,
  cwd = process.cwd(),
): DatabaseSeedTarget {
  if (!args.includes("--remote")) {
    return {
      kind: "pglite",
      dataDir: resolveLocalPgliteDataDir(env, cwd),
    };
  }

  if (env.ALLOW_REMOTE_DATABASE_SEED !== "1") {
    throw new Error(
      "Remote database reset refused. Set ALLOW_REMOTE_DATABASE_SEED=1 to opt in.",
    );
  }

  const unpooledUrl = env.DATABASE_URL_UNPOOLED?.trim();
  const pooledUrl = env.DATABASE_URL?.trim();
  const databaseUrl =
    unpooledUrl && unpooledUrl.length > 0 ? unpooledUrl : pooledUrl;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL_UNPOOLED or DATABASE_URL is required for --remote",
    );
  }

  return { kind: "postgres", databaseUrl };
}
