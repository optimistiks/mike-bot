import type { Chat, Message, PhotoSize, Update } from "grammy/types";

import type { MarkSource, MarkType } from "@/lib/domain/mark";
import { isActiveChatMemberStatus } from "@/lib/mini-app/membership-status";
import { isSeasonOpenForAction } from "@/lib/scoring";

import { memberDisplayName } from "./display-name";
import type { MarkChange, MarkIdentity } from "./marks";
import {
  diffReactionStates,
  reactionDiffToMarkChanges,
} from "./reaction-events";
import { acknowledgementText, replyTextToMarkType } from "./reply-marks";
import { miniAppLink, STATS_BUTTON_TEXT, STATS_MESSAGE_TEXT } from "./stats";

/** The cached Message a reaction update concerns, looked up before reading. */
export interface CachedMessage {
  authorId: number;
  authorIsBot: boolean;
  messageDate: number;
}

export type MessageToCache = CachedMessage & {
  chatId: number;
  messageId: number;
};

export interface IdentityToTouch {
  chatId: number;
  userId: number;
  displayName: string;
}

export interface MarkChangesToApply {
  identity: MarkIdentity;
  changes: MarkChange[];
  createdAt: Date;
  source: MarkSource;
  updateId: number;
}

export interface ChatMetadataToMirror {
  chat: Chat;
  newTitle?: string;
  newPhoto?: PhotoSize[];
  deletePhoto?: boolean;
}

/** Something to say in the Chat once the transaction has committed. */
export type Announcement =
  | {
      kind: "stats";
      chatId: number;
      receiverUserId: number;
      text: string;
      buttonText: string;
      url: string;
    }
  | {
      kind: "scoring-reply";
      chatId: number;
      deleteMessageId: number;
      replyToMessageId: number;
      text: string;
    };

/**
 * Everything one Telegram update tells Mike-bot about a Chat.
 *
 * Declarative writes, not decisions: the applier executes them in order and
 * decides nothing. `acknowledgement` is the one contingent item — a Scoring
 * reply is answered only if it actually spent a grant, which only the write
 * knows — so it is kept apart from the unconditional `announcement`.
 */
export interface ChatFacts {
  metadata: ChatMetadataToMirror | null;
  messages: MessageToCache[];
  identities: IdentityToTouch[];
  markChanges: MarkChangesToApply | null;
  addRegistration: { chatId: number; userId: number } | null;
  removeRegistration: { chatId: number; userId: number } | null;
  announcement: Announcement | null;
  acknowledgement: Announcement | null;
  /** Why nothing was written, for the diagnostic log. Never a control signal. */
  skipped: { reason: string; detail?: Record<string, unknown> } | null;
}

const NOTHING: ChatFacts = {
  metadata: null,
  messages: [],
  identities: [],
  markChanges: null,
  addRegistration: null,
  removeRegistration: null,
  announcement: null,
  acknowledgement: null,
  skipped: null,
};

function nothing(reason?: string, detail?: Record<string, unknown>): ChatFacts {
  return reason ? { ...NOTHING, skipped: { reason, detail } } : NOTHING;
}

export interface DisplayIdentityMember {
  id: number;
  is_bot: boolean;
  username?: string;
  first_name: string;
}

/**
 * The Members a message tells us about: its sender, and the author of whatever
 * it replies to.
 *
 * Sorted by user id and deduplicated so that two updates touching the same pair
 * — Alice replying to Bob while Bob replies to Alice — take the identity rows
 * in the same order and cannot deadlock against each other.
 */
export function messageDisplayIdentities(message: {
  from?: DisplayIdentityMember;
  reply_to_message?: { from?: DisplayIdentityMember };
}): DisplayIdentityMember[] {
  const members = new Map<number, DisplayIdentityMember>();

  for (const candidate of [message.from, message.reply_to_message?.from]) {
    if (candidate && !candidate.is_bot) {
      members.set(candidate.id, candidate);
    }
  }

  return [...members.values()].sort((left, right) => left.id - right.id);
}

/** A `/name` at the very start, with or without the bot's @username. */
function isCommand(
  message: Message,
  name: string,
  botUsername: string,
): boolean {
  const text = message.text;
  const entity = message.entities?.at(0);
  if (!text || entity?.type !== "bot_command" || entity.offset !== 0) {
    return false;
  }

  const token = text.slice(0, entity.length);

  return token === `/${name}` || token === `/${name}@${botUsername}`;
}

function scoringReplyMarkType(message: Message): MarkType | null {
  return message.reply_to_message !== undefined && message.text !== undefined
    ? replyTextToMarkType(message.text)
    : null;
}

function readMessage(
  message: NonNullable<Update["message"]>,
  updateId: number,
  botUsername: string,
): ChatFacts {
  if (message.chat.type !== "supergroup") {
    return nothing();
  }

  if (message.migrate_to_chat_id !== undefined) {
    // Mike-bot serves supergroups, so an upgrade cannot bring history with it
    // and there is nothing to move (ADR-0016).
    return nothing();
  }

  const chatId = message.chat.id;
  const facts: ChatFacts = {
    ...NOTHING,
    metadata: {
      chat: message.chat,
      newTitle: message.new_chat_title,
      newPhoto: message.new_chat_photo,
      deletePhoto: message.delete_chat_photo,
    },
    messages: [],
    identities: [],
  };

  // Ephemeral messages carry message_id 0 and cannot be reacted to, so caching
  // them would only write a junk (chat_id, 0) row. A Scoring reply is about to
  // be deleted and replaced by the bot's own answer, so it is not a Message
  // anyone should be able to mark either — reacting to a bare "+" would spend a
  // grant on its author for typing it.
  const isScoringReply = scoringReplyMarkType(message) !== null;
  if (message.ephemeral_message_id === undefined && !isScoringReply) {
    facts.messages.push({
      chatId,
      messageId: message.message_id,
      authorId: message.from.id,
      authorIsBot: message.from.is_bot,
      messageDate: message.date,
    });
  }

  const repliedTo = message.reply_to_message;
  if (repliedTo?.from) {
    facts.messages.push({
      chatId,
      messageId: repliedTo.message_id,
      authorId: repliedTo.from.id,
      authorIsBot: repliedTo.from.is_bot,
      messageDate: repliedTo.date,
    });
  }

  for (const member of messageDisplayIdentities(message)) {
    facts.identities.push({
      chatId,
      userId: member.id,
      displayName: memberDisplayName(member),
    });
  }

  // /register is an alias of /stats: both establish Registration and reply with
  // the same Mini App deep link.
  const actor = message.from;
  if (
    !actor.is_bot &&
    (isCommand(message, "stats", botUsername) ||
      isCommand(message, "register", botUsername))
  ) {
    facts.addRegistration = { chatId, userId: actor.id };
    facts.announcement = {
      kind: "stats",
      chatId,
      receiverUserId: actor.id,
      text: STATS_MESSAGE_TEXT,
      buttonText: STATS_BUTTON_TEXT,
      url: miniAppLink(botUsername, chatId),
    };

    return facts;
  }

  return { ...facts, ...readScoringReply(message, updateId) };
}

function readScoringReply(
  message: NonNullable<Update["message"]>,
  updateId: number,
): Pick<ChatFacts, "markChanges" | "acknowledgement"> {
  const actor = message.from;
  const repliedTo = message.reply_to_message;
  const subject = repliedTo?.from;
  const type = scoringReplyMarkType(message);

  if (
    !type ||
    actor.is_bot ||
    !repliedTo ||
    // In a forum, Telegram fills reply_to_message with the topic's opening
    // message for every message in the topic, so a bare "+" replying to nobody
    // would mark whoever started it.
    repliedTo.forum_topic_created !== undefined ||
    !subject ||
    subject.is_bot ||
    actor.id === subject.id
  ) {
    return { markChanges: null, acknowledgement: null };
  }

  const createdAt = new Date(message.date * 1_000);
  if (!isSeasonOpenForAction(new Date(repliedTo.date * 1_000), createdAt)) {
    return { markChanges: null, acknowledgement: null };
  }

  return {
    markChanges: {
      identity: {
        chatId: message.chat.id,
        actorId: actor.id,
        subjectId: subject.id,
        messageId: repliedTo.message_id,
      },
      changes: [{ action: "add", type }],
      createdAt,
      source: "reply",
      updateId,
    },
    acknowledgement: {
      kind: "scoring-reply",
      chatId: message.chat.id,
      deleteMessageId: message.message_id,
      replyToMessageId: repliedTo.message_id,
      text: acknowledgementText(type, actor),
    },
  };
}

function readChatMember(update: NonNullable<Update["chat_member"]>): ChatFacts {
  if (update.chat.type !== "supergroup") {
    return nothing();
  }

  const chatId = update.chat.id;
  const member = update.new_chat_member;

  return {
    ...NOTHING,
    metadata: { chat: update.chat },
    identities: member.user.is_bot
      ? []
      : [
          {
            chatId,
            userId: member.user.id,
            displayName: memberDisplayName(member.user),
          },
        ],
    removeRegistration: isActiveChatMemberStatus(member.status)
      ? null
      : { chatId, userId: member.user.id },
  };
}

function readReaction(
  reaction: NonNullable<Update["message_reaction"]>,
  updateId: number,
  cachedMessage: CachedMessage | null,
): ChatFacts {
  if (reaction.chat.type !== "supergroup") {
    return nothing();
  }

  const actor = reaction.user;
  if (!actor || actor.is_bot) {
    return nothing();
  }

  const chatId = reaction.chat.id;
  const metadata: ChatMetadataToMirror = { chat: reaction.chat };
  const messageId = reaction.message_id;

  if (cachedMessage === null) {
    return {
      ...nothing("skip uncached message", {
        chat_id: chatId,
        message_id: messageId,
        actor_id: actor.id,
      }),
      metadata,
    };
  }

  // Bot-authored messages are never Subjects, so reactions on them score nothing.
  if (cachedMessage.authorIsBot) {
    return { ...NOTHING, metadata };
  }

  const mapped = reactionDiffToMarkChanges({
    ...diffReactionStates(reaction.old_reaction, reaction.new_reaction),
    actorId: actor.id,
    subjectId: cachedMessage.authorId,
    subjectIsBot: cachedMessage.authorIsBot,
  });

  if (!mapped.ok || mapped.changes.length === 0) {
    return { ...NOTHING, metadata };
  }

  const createdAt = new Date(reaction.date * 1000);
  if (Number.isNaN(createdAt.getTime())) {
    // No retry can succeed on a timestamp the bot cannot read, and throwing
    // would ask Telegram to redeliver this update until it gives up.
    return {
      ...nothing("skip reaction with an unreadable date", {
        chat_id: chatId,
        message_id: messageId,
        actor_id: actor.id,
        date: reaction.date,
      }),
      metadata,
    };
  }

  if (
    !isSeasonOpenForAction(
      new Date(cachedMessage.messageDate * 1000),
      createdAt,
    )
  ) {
    return { ...NOTHING, metadata };
  }

  return {
    ...NOTHING,
    metadata,
    identities: [
      { chatId, userId: actor.id, displayName: memberDisplayName(actor) },
    ],
    markChanges: {
      identity: {
        chatId,
        actorId: actor.id,
        subjectId: cachedMessage.authorId,
        messageId,
      },
      changes: mapped.changes,
      createdAt,
      source: "reaction",
      updateId,
    },
  };
}

/**
 * Read one Telegram update into the facts it implies.
 *
 * A total function: no database, no network, no clock beyond the timestamps the
 * update carries. Everything that decides whether a Scoring action counts lives
 * here, so both ingestion paths state those rules once and a test can ask what
 * an update writes without writing anything.
 */
export function readUpdate(
  update: Update,
  cachedMessage: CachedMessage | null,
  botUsername: string,
): ChatFacts {
  if (update.message) {
    return readMessage(update.message, update.update_id, botUsername);
  }

  if (update.chat_member) {
    return readChatMember(update.chat_member);
  }

  if (update.message_reaction) {
    return readReaction(
      update.message_reaction,
      update.update_id,
      cachedMessage,
    );
  }

  return nothing();
}

/** The Message a reaction update concerns, so the applier can look it up. */
export function reactionMessageRef(
  update: Update,
): { chatId: number; messageId: number } | null {
  const reaction = update.message_reaction;

  return reaction
    ? { chatId: reaction.chat.id, messageId: reaction.message_id }
    : null;
}
