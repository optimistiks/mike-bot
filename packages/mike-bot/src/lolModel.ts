import {
  Model,
  PartitionKey,
  DynamoStore,
  Property,
  dateToNumberMapper,
} from "@shiftcoders/dynamo-easy";

export enum LolType {
  lol = "lol",
  plus = "plus",
  minus = "minus",
}

export class User {
  id: number;
  username?: string;
}

@Model({ tableName: process.env.LOL_TABLE_NAME })
export class Lol {
  @PartitionKey()
  id: string;

  @Property({ mapper: dateToNumberMapper })
  createdAt: Date;

  lolType: LolType;
  fromUser: User;
  toUser: User;
  chatId: number;
  toMessageId: number;
}

export const lolStore = new DynamoStore(Lol);
