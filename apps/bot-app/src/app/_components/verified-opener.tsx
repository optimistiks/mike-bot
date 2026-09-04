"use client";

import type { ReactElement } from "react";

import { use } from "react";

import type { OpenerProfile } from "@/tma/opener";

import { OpenerCard } from "@/app/_components/opener-card";
import { START_FAILED } from "@/app/_components/opener-copy";
import { Status } from "@/app/_components/status";
import { openerProfileFromUnknown } from "@/tma/opener";

const openerByInitData = new Map<string, Promise<OpenerProfile | null>>();

async function loadOpener(initDataRaw: string): Promise<OpenerProfile | null> {
  try {
    const response = await fetch("/api/me", {
      headers: { Authorization: `tma ${initDataRaw}` },
    });
    if (!response.ok) {
      return null;
    }
    return openerProfileFromUnknown(await response.json());
  } catch {
    return null;
  }
}

function loadOpenerCached(initDataRaw: string): Promise<OpenerProfile | null> {
  const cached = openerByInitData.get(initDataRaw);
  if (cached !== undefined) {
    return cached;
  }
  const request = loadOpener(initDataRaw);
  openerByInitData.set(initDataRaw, request);
  return request;
}

function VerifiedOpener({ initDataRaw }: { initDataRaw: string }): ReactElement {
  const profile = use(loadOpenerCached(initDataRaw));
  if (profile === null) {
    return <Status text={START_FAILED} />;
  }
  return <OpenerCard profile={profile} />;
}

export { VerifiedOpener };
