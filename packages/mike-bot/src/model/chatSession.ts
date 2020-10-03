import {
  Model,
  PartitionKey,
  DynamoStore,
  Property,
  dateToNumberMapper,
} from "@shiftcoders/dynamo-easy";

@Model({ tableName: process.env.CHAT_SESSION_TABLE_NAME })
export class ChatSession {
  @PartitionKey()
  id: string;

  @Property({ mapper: dateToNumberMapper })
  createdAt: Date;

  userId: number;
  chatId: number;
}

export const chatSessionStore = new DynamoStore(ChatSession);
