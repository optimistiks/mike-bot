import { describe, expect, it } from 'vitest';

import { leaderboardQuerySchema } from './schema';

describe('leaderboardQuerySchema', () => {
  it('accepts chat_id with optional year and month', () => {
    const parsed = leaderboardQuerySchema.parse({
      chat_id: '-100456789',
      year: '2026',
      month: '8',
    });

    expect(parsed).toEqual({
      chatId: -100_456_789,
      year: 2026,
      month: 8,
    });
  });

  it('rejects partial season parameters', () => {
    const parsed = leaderboardQuerySchema.safeParse({
      chat_id: '1',
      year: '2026',
    });

    expect(parsed.success).toBe(false);
  });
});
