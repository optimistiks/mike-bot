"use client";

import { useEffect, useState } from "react";

import { AvatarImage } from "@/components/ui/8bit/avatar";

/**
 * An avatar image whose bytes arrived over an authenticated fetch.
 *
 * Both photo endpoints need an Authorization header, which `<img src>` cannot
 * send, so the blob is turned into an object URL here and revoked when the
 * avatar goes away. The URL is created once per mount rather than per render:
 * recreating it would swap the `src` and make the face flicker.
 */
export function BlobImage({ blob }: { blob: Blob }) {
  const [url] = useState(() => URL.createObjectURL(blob));

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [url]);

  return <AvatarImage src={url} alt="" />;
}
