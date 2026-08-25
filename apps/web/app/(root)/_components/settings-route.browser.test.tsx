import { HttpResponse, http } from "msw";
import { expect, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { ScoringReactionsResponse } from "@/lib/bot/scoring-reactions-schema";
import {
  MiniAppProviders,
  TEST_INIT_DATA,
  telegramContextStub,
  telegramPlatformStub,
} from "@/test/browser/mini-app";
import { test } from "@/test/browser/msw";

import { SettingsRoute } from "./settings-route";

const telegram = vi.hoisted<{ context: unknown }>(() => ({ context: null }));

vi.mock("./telegram-provider", () => ({
  useTelegramPlatform: () => telegram.context,
}));

vi.mock("./directional-transition", () => ({
  DirectionalTransition: ({ children }: { children: React.ReactNode }) =>
    children,
}));

const CHAT_ID = -100_111_222;

function response(
  overrides: Partial<ScoringReactionsResponse> = {},
): ScoringReactionsResponse {
  return {
    reactions: [
      { reactionKey: "emoji:👍", label: null, markType: "karma.plus" },
      { reactionKey: "emoji:👎", label: null, markType: "karma.minus" },
      { reactionKey: "emoji:🤣", label: null, markType: "humor.add" },
    ],
    usingDefaults: true,
    canEdit: true,
    ...overrides,
  };
}

async function renderSettings() {
  const platform = telegramPlatformStub();
  telegram.context = telegramContextStub(platform);

  return render(
    <MiniAppProviders>
      <SettingsRoute chatId={CHAT_ID} />
    </MiniAppProviders>,
  );
}

/** The toggle for one reaction under one Mark. */
function toggle(
  screen: Awaited<ReturnType<typeof renderSettings>>,
  face: string,
  mark: string,
) {
  return screen.getByRole("button", { name: `${face} — ${mark}` });
}

test("shows what the Chat scores by", async ({ worker }) => {
  worker.use(
    http.get("*/api/chats/:chatId/scoring-reactions", ({ request }) => {
      expect(request.headers.get("authorization")).toBe(
        `tma ${TEST_INIT_DATA}`,
      );
      return HttpResponse.json(response());
    }),
  );

  const screen = await renderSettings();

  await expect.element(toggle(screen, "👍", "Карма +")).toBeVisible();
  await expect
    .element(toggle(screen, "🤣", "Юмор"))
    .toHaveAttribute("aria-pressed", "true");
});

test("moves a reaction between Marks instead of holding both", async ({
  worker,
}) => {
  worker.use(
    http.get("*/api/chats/:chatId/scoring-reactions", () =>
      HttpResponse.json(response()),
    ),
  );

  const screen = await renderSettings();

  await toggle(screen, "🤣", "Карма +").click();

  // The whole point of keying state by reaction: binding 🤣 to Karma plus takes
  // it away from Humor with no rule anywhere saying so.
  await expect
    .element(toggle(screen, "🤣", "Карма +"))
    .toHaveAttribute("aria-pressed", "true");
  await expect
    .element(toggle(screen, "🤣", "Юмор"))
    .toHaveAttribute("aria-pressed", "false");
});

test("saves every binding in one PUT", async ({ worker }) => {
  let sent: unknown = null;

  worker.use(
    http.get("*/api/chats/:chatId/scoring-reactions", () =>
      HttpResponse.json(response()),
    ),
    http.put("*/api/chats/:chatId/scoring-reactions", async ({ request }) => {
      sent = await request.json();
      return HttpResponse.json(
        response({
          usingDefaults: false,
          reactions: [
            { reactionKey: "emoji:👍", label: null, markType: "karma.plus" },
            { reactionKey: "emoji:👎", label: null, markType: "karma.minus" },
            { reactionKey: "emoji:🤣", label: null, markType: "karma.plus" },
          ],
        }),
      );
    }),
  );

  const screen = await renderSettings();

  await toggle(screen, "🤣", "Карма +").click();
  await screen.getByRole("button", { name: "сохранить" }).click();

  await expect.poll(() => sent).not.toBeNull();
  expect(sent).toEqual({
    bindings: {
      "karma.plus": ["emoji:👍", "emoji:🤣"],
      "karma.minus": ["emoji:👎"],
    },
  });
});

test("offers no save to a Member who does not administer the Chat", async ({
  worker,
}) => {
  worker.use(
    http.get("*/api/chats/:chatId/scoring-reactions", () =>
      HttpResponse.json(response({ canEdit: false })),
    ),
  );

  const screen = await renderSettings();

  await expect
    .element(
      screen.getByText("Менять реакции могут только администраторы группы."),
    )
    .toBeVisible();
  await expect.element(toggle(screen, "👍", "Карма +")).toBeDisabled();
});

test("disables Save while the save is in flight", async ({ worker }) => {
  let release: () => void = () => undefined;
  const inFlight = new Promise<void>((resolve) => {
    release = resolve;
  });

  worker.use(
    http.get("*/api/chats/:chatId/scoring-reactions", () =>
      HttpResponse.json(response()),
    ),
    http.put("*/api/chats/:chatId/scoring-reactions", async () => {
      await inFlight;

      return HttpResponse.json(response({ usingDefaults: false }));
    }),
  );

  const screen = await renderSettings();
  const save = screen.getByRole("button", { name: "сохранить" });

  await toggle(screen, "🤣", "Карма +").click();
  await save.click();

  await expect
    .element(screen.getByRole("button", { name: "сохраняю…" }))
    .toBeDisabled();

  release();

  await expect.element(save).toBeEnabled();
});

test("marks a custom reaction as custom", async ({ worker }) => {
  worker.use(
    http.get("*/api/chats/:chatId/scoring-reactions", () =>
      HttpResponse.json(
        response({
          usingDefaults: false,
          reactions: [
            { reactionKey: "custom_emoji:9001", label: "🎉", markType: null },
            { reactionKey: "emoji:🎉", label: null, markType: "humor.add" },
          ],
        }),
      ),
    ),
  );

  const screen = await renderSettings();

  // Both tiles read 🎉; only one is a custom emoji, and they score differently.
  await expect
    .element(screen.getByRole("button", { name: "🎉 (своя) — Юмор" }))
    .toBeVisible();
  await expect.element(toggle(screen, "🎉", "Юмор")).toBeVisible();
});

test("shows a captured custom reaction by its stand-in", async ({ worker }) => {
  worker.use(
    http.get("*/api/chats/:chatId/scoring-reactions", () =>
      HttpResponse.json(
        response({
          usingDefaults: false,
          reactions: [
            { reactionKey: "custom_emoji:9001", label: "🎉", markType: null },
          ],
        }),
      ),
    ),
  );

  const screen = await renderSettings();
  const tile = screen.getByRole("button", { name: "🎉 (своя) — Юмор" });

  await expect.element(tile).toBeVisible();
  await expect.element(tile).toHaveAttribute("aria-pressed", "false");
});
