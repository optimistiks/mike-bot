"use client";

import type { ReactElement } from "react";

import { captureException } from "@sentry/nextjs";
import { useEffect } from "react";

import { FailedView } from "@/app/_components/failed-view";

function GlobalError({ error }: { error: Error & { digest?: string } }): ReactElement {
  useEffect(() => {
    captureException(error);
  }, [error]);

  return (
    <html lang="ru">
      <body className="flex min-h-full flex-col">
        <FailedView kind="initialization-error" />
      </body>
    </html>
  );
}

export default GlobalError;
