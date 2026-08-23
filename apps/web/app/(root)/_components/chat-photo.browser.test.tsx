import { HttpResponse, http } from "msw";
import { expect, vi } from "vitest";
import { render } from "vitest-browser-react";

import {
  MiniAppProviders,
  TEST_INIT_DATA,
  telegramContextStub,
  telegramPlatformStub,
} from "@/test/browser/mini-app";
import { test } from "@/test/browser/msw";

import { ChatPhoto } from "./chat-photo";

const telegram = vi.hoisted<{ context: unknown }>(() => ({
  context: null,
}));

vi.mock("./telegram-provider", () => ({
  useTelegramPlatform: () => telegram.context,
}));

const CHAT_ID = -100_456_789;
const CHAT_WITHOUT_PHOTO_ID = -100_222_333;

/** A 1×1 transparent PNG, so the avatar has something that really decodes. */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

function pngBytes(): Uint8Array {
  return Uint8Array.from(atob(PNG_BASE64), (character) =>
    character.charCodeAt(0),
  );
}

async function renderPhoto(
  photoVersion: string | null,
  chatId: number = CHAT_ID,
) {
  telegram.context = telegramContextStub(telegramPlatformStub());

  return render(
    <MiniAppProviders>
      <ChatPhoto
        chat={{ chatId, title: "Клуб пятничных созвонов", photoVersion }}
      />
    </MiniAppProviders>,
  );
}

test("shows the Chat photo streamed through the authenticated proxy", async ({
  worker,
}) => {
  let authorization: string | null = null;
  worker.use(
    http.get(`*/api/chats/${String(CHAT_ID)}/photo`, ({ request }) => {
      authorization = request.headers.get("authorization");
      return HttpResponse.arrayBuffer(pngBytes().buffer, {
        headers: { "content-type": "image/png" },
      });
    }),
  );

  const screen = await renderPhoto("photo-version-1");

  await expect.poll(() => screen.container.querySelector("img")).toBeTruthy();
  expect(screen.container.querySelector("img")?.getAttribute("src")).toMatch(
    /^blob:/,
  );
  expect(authorization).toBe(`tma ${TEST_INIT_DATA}`);
});

test("falls back to Chat-title initials when the photo cannot be fetched", async ({
  worker,
}) => {
  worker.use(
    http.get(
      `*/api/chats/${String(CHAT_ID)}/photo`,
      () => new HttpResponse(null, { status: 404 }),
    ),
  );

  const screen = await renderPhoto("photo-version-1");

  await expect.element(screen.getByText("КП")).toBeVisible();
});

test("asks for nothing when the Chat has no photo", async ({ worker }) => {
  const requests: string[] = [];
  worker.use(
    http.get("*/api/chats/*/photo", ({ request }) => {
      requests.push(request.url);
      return new HttpResponse(null, { status: 404 });
    }),
  );

  const screen = await renderPhoto(null, CHAT_WITHOUT_PHOTO_ID);

  await expect.element(screen.getByText("КП")).toBeVisible();
  expect(
    requests.filter((url) =>
      url.includes(`/chats/${String(CHAT_WITHOUT_PHOTO_ID)}/photo`),
    ),
  ).toEqual([]);
});

/**
 * The frame and the type inside it drifted apart once already — 40px here, 48px
 * there, the same 14px in both — and one Chat's initials filled two different
 * fractions of the same octagon depending on the screen. Nothing but the table
 * may decide either half of that pair.
 */
test("renders a Chat at 48px around 16px type", async () => {
  const screen = await renderPhoto(null, CHAT_WITHOUT_PHOTO_ID);

  // Spelled out rather than read from `photoSizes`: taking the expectation from
  // the same table the component reads would let both halves move together,
  // which is the one thing this test exists to catch.
  const fallback = screen.container.querySelector(
    '[data-slot="avatar-fallback"]',
  );
  expect(fallback?.classList.contains("arcade-initials")).toBe(true);
  expect(fallback?.classList.contains("arcade-text-lg")).toBe(true);
  expect(screen.container.querySelector(".size-12")).toBeTruthy();
});
