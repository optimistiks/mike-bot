import { HttpResponse, http } from "msw";
import { expect, vi } from "vitest";
import { render } from "vitest-browser-react";

import {
  MiniAppProviders,
  telegramContextStub,
  telegramPlatformStub,
} from "@/test/browser/mini-app";
import { test } from "@/test/browser/msw";

import { MemberPhoto } from "./member-photo";

const telegram = vi.hoisted<{ context: unknown }>(() => ({ context: null }));

vi.mock("./telegram-provider", () => ({
  useTelegramPlatform: () => telegram.context,
}));

const SUBJECT_ID = 909;
// A one-pixel GIF: the smallest thing the browser will decode as an image.
const PIXEL_GIF = Uint8Array.from(
  atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"),
  (character) => character.charCodeAt(0),
);

function renderPhoto() {
  telegram.context = telegramContextStub(telegramPlatformStub());

  return render(
    <MiniAppProviders>
      <MemberPhoto userId={SUBJECT_ID} displayName="@first_member" />
    </MiniAppProviders>,
  );
}

test("shows the Member's Telegram photo once it arrives", async ({
  worker,
}) => {
  worker.use(
    http.get(
      "*/api/members/909/photo",
      () =>
        new HttpResponse(PIXEL_GIF, {
          headers: { "Content-Type": "image/gif" },
        }),
    ),
  );

  const screen = await renderPhoto();

  // The photo is decorative — the name is right beside it — so it carries an
  // empty alt and no img role to look it up by.
  await vi.waitFor(() => {
    expect(screen.container.querySelector("img")).not.toBeNull();
  });
});

test("keeps the initials when the Member has no photo to show", async ({
  worker,
}) => {
  // The initials are on screen before the request is even sent, so waiting on
  // them alone would assert nothing about the 404 — and would let the test end
  // with the request still in flight, to arrive after its handler is gone.
  let answered = 0;
  worker.use(
    http.get("*/api/members/909/photo", () => {
      answered += 1;
      return new HttpResponse(null, { status: 404 });
    }),
  );

  const screen = await renderPhoto();
  await expect.poll(() => answered).toBe(1);

  await expect.element(screen.getByText("FM")).toBeVisible();
  expect(screen.container.querySelector("img")).toBeNull();
});
