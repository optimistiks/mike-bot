import Link from "next/link";

import { Avatar, AvatarFallback } from "@/components/ui/8bit/avatar";
import { Item, ItemContent, ItemMedia } from "@/components/ui/8bit/item";

export function ChatCard({
  href,
  name,
  initials,
}: {
  href: string;
  name: string;
  initials: string;
}) {
  return (
    <Item render={<Link href={href} />} className="items-start gap-3 px-3 py-4">
      <ItemMedia>
        <Avatar variant="pixel" className="size-12">
          <AvatarFallback className="arcade-text-md bg-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
      </ItemMedia>
      {/* No truncation anywhere: a Chat name gets as many lines as it needs. */}
      <ItemContent>
        <span className="arcade-text-md leading-relaxed break-words">
          {name}
        </span>
      </ItemContent>
    </Item>
  );
}
