"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";

/**
 * Once per session, not once per mount. A fresh Telegram launch is a fresh
 * session and gets the boot; walking from the Chat list into a Leaderboard is
 * not, and does not.
 */
const SESSION_KEY = "arcade:boot-played";

/** Matches the CSS animations' total length. */
const BOOT_MS = 1400;

type BootPhase = "waiting" | "playing" | "done";

/*
 * The boot lives in a module store rather than in component state because it is
 * a browser fact — whether this session has already seen it — and a browser
 * fact cannot be read during a server render without lying. `useSyncExternalStore`
 * is the sanctioned way to have the server and the first client pass agree on
 * "not yet known" and only then learn the truth, so nothing has to be hydrated
 * twice or suppressed.
 */

let phase: BootPhase = "waiting";
const listeners = new Set<() => void>();

function announce(next: BootPhase) {
  phase = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readPhase(): BootPhase {
  return phase;
}

/** The server, and the client's hydrating pass, both know nothing yet. */
function readInitialPhase(): BootPhase {
  return "waiting";
}

/**
 * Claims this session's single boot, if it is still going.
 *
 * The session flag is written the moment the boot is claimed rather than when
 * it finishes, so a Member who skips it, or who navigates away mid-boot, is not
 * shown it again. `sessionStorage` is guarded: it throws outright in some
 * embedded webviews with storage disabled, and a boot animation is not worth
 * taking the app down for. Never booting is the safer of the two ways to break
 * a "once per session" promise that cannot be kept.
 */
function claimBoot() {
  if (phase !== "waiting") return;

  let hasPlayed: boolean;

  try {
    hasPlayed = sessionStorage.getItem(SESSION_KEY) !== null;
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    announce("done");
    return;
  }

  if (hasPlayed) {
    announce("done");
    return;
  }

  announce("playing");
  setTimeout(() => {
    announce("done");
  }, BOOT_MS);
}

/**
 * The CRT power-on: a black screen, a scanline drawn across it, and a flash
 * that opens into the app.
 *
 * It plays once per session and is skippable by tapping, because the
 * personality must never cost a Member time when they only want the numbers.
 * Skipping is the whole overlay leaving at once rather than fast-forwarding —
 * a tap means "I am done with this", not "do it quicker".
 */
export function CrtBoot() {
  const bootPhase = useSyncExternalStore(
    subscribe,
    readPhase,
    readInitialPhase,
  );

  // A layout effect rather than a passive one: the boot is claimed and the veil
  // committed before the browser paints the hydrated app, instead of one frame
  // after it. The server-rendered HTML still paints before any of this runs —
  // that paint belongs to the document, not to React, and no client-side hook
  // can precede it — so a very slow hydration can still show a frame of the app
  // before the tube warms up.
  useLayoutEffect(() => {
    claimBoot();
  }, []);

  if (bootPhase !== "playing") return null;

  return (
    <div
      className="arcade-boot"
      aria-hidden="true"
      onPointerDown={() => {
        announce("done");
      }}
    >
      <div className="arcade-boot-beam" />
    </div>
  );
}
