import "server-only";

import { parseBotToken } from "@/lib/env.server";

import { authenticateTmaMember, type AuthenticatedMember } from "./init-data";

export async function authenticateTmaRequestMember(
  authorization: string | null,
): Promise<AuthenticatedMember | null> {
  if (process.env.NODE_ENV === "production") {
    return authenticateTmaMember(authorization, parseBotToken());
  }

  const productionBotToken = process.env.BOT_TOKEN?.trim();
  if (productionBotToken) {
    const productionMember = authenticateTmaMember(
      authorization,
      productionBotToken,
    );
    if (productionMember) {
      return productionMember;
    }
  }

  if (!process.env.TMA_DEVELOPMENT_BOT_TOKEN?.trim()) {
    return null;
  }

  const { parseDevelopmentBotToken } =
    await import("./development-init-data.server");
  return authenticateTmaMember(authorization, parseDevelopmentBotToken());
}
