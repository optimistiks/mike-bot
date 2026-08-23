"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  initializeTelegramPlatform,
  type MiniAppLaunch,
  type TelegramPlatform,
} from "../_lib/telegram-platform";
import { BackButtonSync } from "./back-button-sync";

interface TelegramContextValue {
  launch: MiniAppLaunch | null;
  platform: TelegramPlatform | null;
  isInitialized: boolean;
  hapticImpact: VoidFunction;
  hapticSelection: VoidFunction;
  hapticNotificationSuccess: VoidFunction;
  interceptBack: (handler: VoidFunction) => VoidFunction;
}

const TelegramContext = createContext<TelegramContextValue | null>(null);
const doNothing = () => undefined;

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [launch, setLaunch] = useState<MiniAppLaunch | null>(null);
  const backInterceptor = useRef<VoidFunction | null>(null);
  const platform = launch?.kind === "telegram" ? launch.platform : null;

  useEffect(() => {
    let cancelled = false;
    void initializeTelegramPlatform().then((result) => {
      if (!cancelled) setLaunch(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    platform?.ready();
  }, [platform]);

  const handleBack = useCallback(() => {
    if (backInterceptor.current) {
      backInterceptor.current();
      return;
    }
    router.replace("/chats", { transitionTypes: ["nav-back"] });
  }, [router]);

  const interceptBack = useCallback((handler: VoidFunction) => {
    backInterceptor.current = handler;
    return () => {
      if (backInterceptor.current === handler) backInterceptor.current = null;
    };
  }, []);

  const value = useMemo<TelegramContextValue>(
    () => ({
      launch,
      platform,
      isInitialized: platform !== null,
      hapticImpact: platform?.impact ?? doNothing,
      hapticSelection: platform?.selection ?? doNothing,
      hapticNotificationSuccess: platform?.notificationSuccess ?? doNothing,
      interceptBack,
    }),
    [interceptBack, launch, platform],
  );

  return (
    <TelegramContext.Provider value={value}>
      {children}
      <Suspense fallback={null}>
        <BackButtonSync platform={platform} onBack={handleBack} />
      </Suspense>
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
