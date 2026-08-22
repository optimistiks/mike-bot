import "./arcade.css";

import { CrtBoot } from "./_components/crt-boot";
import { SeasonGlitch } from "./_components/season-glitch";
import { TelegramProvider } from "./_components/telegram-provider";

/**
 * The prototype's shell, and the one thing in it that outlives a navigation.
 *
 * Both overlays are here rather than on a page for that reason: the boot has to
 * play once per session rather than once per page, and the Season glitch has to
 * see both sides of a navigation that unmounts everything below this.
 */
export default function V2UIPrototypeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <TelegramProvider>
      <div className="arcade">
        {children}
        <SeasonGlitch />
        <CrtBoot />
      </div>
    </TelegramProvider>
  );
}
