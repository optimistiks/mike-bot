import Link from "next/link";

import { Avatar, AvatarFallback } from "@/components/ui/8bit/avatar";
import { Badge } from "@/components/ui/8bit/badge";
import {
  Item,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/8bit/item";

export default function ChatsPrototypePage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <header className="flex flex-col items-start gap-4">
        <Badge variant="outline">MIKE</Badge>
        <h1>Выбери чат</h1>
      </header>

      <ItemGroup className="overflow-hidden border-y-6 border-foreground bg-card px-2 dark:border-ring">
        <Item
          render={<Link href="/prototypes/v2-ui/leaderboards" />}
          aria-label="Открыть чат «Клуб пятничных созвонов»"
        >
          <ItemMedia>
            <Avatar variant="pixel" className="size-12">
              <AvatarFallback className="bg-primary">ПТ</AvatarFallback>
            </Avatar>
          </ItemMedia>
          <ItemContent className="min-w-0">
            <ItemTitle className="max-w-full truncate">
              Клуб пятничных созвонов
            </ItemTitle>
          </ItemContent>
        </Item>
        <ItemSeparator />

        <Item
          render={<Link href="/prototypes/v2-ui/leaderboards" />}
          aria-label="Открыть чат «Продуктовая кухня»"
        >
          <ItemMedia>
            <Avatar variant="pixel" className="size-12">
              <AvatarFallback className="bg-secondary">ПК</AvatarFallback>
            </Avatar>
          </ItemMedia>
          <ItemContent className="min-w-0">
            <ItemTitle className="max-w-full truncate">
              Продуктовая кухня
            </ItemTitle>
          </ItemContent>
        </Item>
        <ItemSeparator />

        <Item
          render={<Link href="/prototypes/v2-ui/leaderboards" />}
          aria-label="Открыть чат «Ночная смена»"
        >
          <ItemMedia>
            <Avatar variant="pixel" className="size-12">
              <AvatarFallback className="bg-accent">НС</AvatarFallback>
            </Avatar>
          </ItemMedia>
          <ItemContent className="min-w-0">
            <ItemTitle className="max-w-full truncate">Ночная смена</ItemTitle>
          </ItemContent>
        </Item>
        <ItemSeparator />

        <Item
          render={<Link href="/prototypes/v2-ui/leaderboards" />}
          aria-label="Открыть чат «Соседи по интернету»"
        >
          <ItemMedia>
            <Avatar variant="pixel" className="size-12">
              <AvatarFallback className="bg-muted">СИ</AvatarFallback>
            </Avatar>
          </ItemMedia>
          <ItemContent className="min-w-0">
            <ItemTitle className="max-w-full truncate">
              Соседи по интернету
            </ItemTitle>
          </ItemContent>
        </Item>
      </ItemGroup>
    </div>
  );
}
