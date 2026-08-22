"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  initializeTelegramPlatform,
  type TelegramPlatform,
  WEB_TELEGRAM_PLATFORM,
} from "../_lib/telegram-platform";

interface TelegramContextValue {
  isInitialized: boolean;
  hapticImpact: VoidFunction;
  hapticSelection: VoidFunction;
  hapticNotificationSuccess: VoidFunction;
  interceptBack: (handler: VoidFunction) => VoidFunction;
}

const TelegramContext = createContext<TelegramContextValue | null>(null);

function isLeaderboardPath(pathname: string): boolean {
  return /\/leaderboards(?:\/|$)/.test(pathname);
}

/**
 * The one owner of Telegram's native controls for the whole prototype.
 *
 * Only one Back Button listener is registered. A modal surface can temporarily
 * intercept that listener; otherwise it returns to the prototype's Chat list
 * regardless of the browser history used to enter the Leaderboard.
 */
export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [platform, setPlatform] = useState<TelegramPlatform>(
    WEB_TELEGRAM_PLATFORM,
  );
  const [isInitialized, setIsInitialized] = useState(false);
  const backInterceptor = useRef<VoidFunction | null>(null);
  const showsBackButton = isLeaderboardPath(pathname);

  useEffect(() => {
    let cancelled = false;

    void initializeTelegramPlatform().then((launched) => {
      if (!cancelled) {
        setPlatform(launched);
        setIsInitialized(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleBack = useCallback(() => {
    const intercept = backInterceptor.current;
    if (intercept) {
      intercept();
      return;
    }

    router.replace("/prototypes/v2-ui/chats");
  }, [router]);

  useEffect(
    () => platform.setBackButton(showsBackButton, handleBack),
    [handleBack, platform, showsBackButton],
  );

  const interceptBack = useCallback((handler: VoidFunction) => {
    backInterceptor.current = handler;

    return () => {
      if (backInterceptor.current === handler) {
        backInterceptor.current = null;
      }
    };
  }, []);

  const value = useMemo<TelegramContextValue>(
    () => ({
      isInitialized,
      hapticImpact: platform.impact,
      hapticSelection: platform.selection,
      hapticNotificationSuccess: platform.notificationSuccess,
      interceptBack,
    }),
    [interceptBack, isInitialized, platform],
  );

  return (
    <TelegramContext.Provider value={value}>
      {children}
    </TelegramContext.Provider>
  );
}

export function useTelegramPlatform(): TelegramContextValue {
  const context = useContext(TelegramContext);
  if (!context) {
    throw new Error("useTelegramPlatform must be used within TelegramProvider");
  }
  return context;
}
