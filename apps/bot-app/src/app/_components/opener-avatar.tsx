import type { ReactElement } from "react";

import Image from "next/image";

import { openerInitial } from "@/tma/opener";

function OpenerAvatar({ name, photoUrl }: { name: string; photoUrl: string | null }): ReactElement {
  if (photoUrl !== null) {
    return (
      <Image
        alt={name}
        className="size-24 rounded-full object-cover"
        height={96}
        loading="eager"
        src={photoUrl}
        unoptimized
        width={96}
      />
    );
  }
  return (
    <div className="flex size-24 items-center justify-center rounded-full bg-[var(--tg-theme-secondary-bg-color,#e5e7eb)] text-3xl font-medium">
      {openerInitial(name)}
    </div>
  );
}

export { OpenerAvatar };
