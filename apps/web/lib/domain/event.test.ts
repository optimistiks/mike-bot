import { describe, expect, it } from 'vitest';

import { eventRecordSchema, eventTypeSchema } from './event';

describe('eventTypeSchema', () => {
  it('accepts the six v2 Event types', () => {
    for (const type of eventTypeSchema.options) {
      expect(eventTypeSchema.parse(type)).toBe(type);
    }
  });

  it('rejects unknown types', () => {
    expect(() => eventTypeSchema.parse('karma.add')).toThrow();
  });
});

describe('eventRecordSchema', () => {
  it('validates a complete Event record', () => {
    const parsed = eventRecordSchema.parse({
      type: 'karma.plus',
      chatId: -100123,
      actorId: 42,
      subjectId: 99,
      messageId: 7,
      createdAt: '2026-08-01T12:00:00.000Z',
      legacyId: null,
    });

    expect(parsed.type).toBe('karma.plus');
    expect(parsed.chatId).toBe(-100123);
    expect(parsed.createdAt).toBeInstanceOf(Date);
  });
});
