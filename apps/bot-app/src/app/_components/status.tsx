import type { ReactElement } from "react";

function Status({ text }: { text: string }): ReactElement {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <p className="text-center text-lg">{text}</p>
    </main>
  );
}

export { Status };
