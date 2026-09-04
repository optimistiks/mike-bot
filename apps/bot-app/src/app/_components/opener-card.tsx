import type { ReactElement } from "react";

import type { OpenerProfile } from "@/tma/opener";

import { OpenerAvatar } from "@/app/_components/opener-avatar";

function OpenerCard({ profile }: { profile: OpenerProfile }): ReactElement {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
      <OpenerAvatar name={profile.name} photoUrl={profile.photoUrl} />
      <p className="text-xl font-medium">{profile.name}</p>
    </main>
  );
}

export { OpenerCard };
