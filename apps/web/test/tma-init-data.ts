import { sign } from "@tma.js/init-data-node";

export const TEST_BOT_TOKEN = "123456789:TEST_BOT_TOKEN";
export const TEST_DEVELOPMENT_BOT_TOKEN =
  "987654321:TEST_DEVELOPMENT_BOT_TOKEN";

export function signedTmaAuthorization(
  userId: number,
  authDate = new Date(),
  token = TEST_BOT_TOKEN,
): string {
  const initData = sign(
    {
      user: {
        id: userId,
        first_name: `Member ${String(userId)}`,
        is_bot: false,
        username: `member_${String(userId)}`,
      },
    },
    token,
    authDate,
  );

  return `tma ${initData}`;
}
