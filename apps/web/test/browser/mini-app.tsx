import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";

import type { TelegramPlatform } from "@/app/(root)/_lib/telegram-platform";

export const TEST_INIT_DATA = "user=test%20member&auth_date=123&hash=signed";

/**
 * A stand-in for the Telegram platform seam.
 *
 * Mini App components never touch the SDK directly — they read this object out
 * of `useTelegramPlatform`, so tests replace it wholesale rather than pretending
 * to be a Telegram client.
 */
export function telegramPlatformStub(
  overrides: Partial<TelegramPlatform> = {},
): TelegramPlatform {
  return {
    initDataRaw: TEST_INIT_DATA,
    memberId: 101,
    supportsNativeBackButton: true,
    impact: vi.fn(),
    selection: vi.fn(),
    notificationSuccess: vi.fn(),
    ready: vi.fn(),
    setBackButton: vi.fn(() => () => undefined),
    ...overrides,
  };
}

export function telegramContextStub(platform: TelegramPlatform) {
  return {
    launch: { kind: "telegram" as const, platform },
    platform,
    isInitialized: true,
    supportsNativeBackButton: platform.supportsNativeBackButton,
    hapticImpact: vi.fn(),
    hapticSelection: vi.fn(),
    hapticNotificationSuccess: vi.fn(),
    interceptBack: vi.fn(() => () => undefined),
  };
}

/** Queries fail fast here; retry policy has its own unit test. */
export function MiniAppProviders({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
