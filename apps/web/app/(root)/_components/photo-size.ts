/**
 * A photo's frame and the type that centres inside it are one decision.
 *
 * They were two, and they drifted: the Leaderboard header asked for 40px around
 * 14px type while the Chats list asked for 48px around the same 14px, so one
 * Chat's initials filled two different fractions of the same octagon depending on
 * which screen you were reading. Naming the pair removes the choice.
 *
 * Both frames are multiples of 16px, which is what the frame's sixteen 6.25% rows
 * divide into whole pixels.
 */
export const photoSizes = {
  /** 32px frame, 10px type — a Member on a standings row. */
  sm: { frame: "size-8", initials: "arcade-text-xs" },
  /**
   * 48px frame, 16px type — a Chat, wherever it appears.
   *
   * 16px is the one size on the arcade scale whose design pixel is a whole 2px,
   * and inside 48px the two glyphs' ink lands at x=9, y=17: integers. The pixel
   * font rasterises crisply instead of smeared across thirds of a device pixel.
   */
  md: { frame: "size-12", initials: "arcade-text-lg" },
} as const;

export type PhotoSize = keyof typeof photoSizes;
