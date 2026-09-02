export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is unset`);
  }
  return value;
}

export function databaseUrl(): string {
  return requireEnv("DATABASE_URL");
}

export function unpooledDatabaseUrl(): string {
  return process.env.DATABASE_URL_UNPOOLED?.trim() || process.env.DATABASE_URL?.trim() || "";
}
