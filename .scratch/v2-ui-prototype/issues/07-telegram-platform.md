# 07: Telegram Mini App platform integration

**What to build:** The prototype stops being a web page that happens to open inside Telegram and starts
behaving like a Mini App. It opens expanded to full height with content clear of notches and home
indicators. Scrolling a long list of standings can no longer accidentally dismiss the app. The native back
button appears and means one predictable thing. Meaningful interactions answer with haptics. Telegram's own
header and bottom bar take on the app's palette, so the Mini App reads as one object rather than a website
embedded in a chat client.

Note this deliberately inverts Telegram's design guidance: rather than adopting `themeParams`, the app
pushes its own palette outward into Telegram's chrome. That is an argued decision recorded in the spec, not
an oversight.

**Blocked by:** 04, 05

**Status:** resolved

- [x] Viewport expands on launch and safe-area insets are respected, so nothing important sits under
      system chrome
- [x] **Vertical swipe-to-dismiss is disabled** — scrolling a long standings list never closes the app.
      This is the highest-value integration in this ticket
- [x] The native back button appears on the Leaderboard and is hidden on the Chat list
- [x] With the Season drawer open, back **closes the drawer** and stays on the Leaderboard
- [x] With the drawer closed, back returns to the Chat list — and because Season changes use replace, it
      does so in one press regardless of how many Seasons were browsed
- [x] Haptic impact on Chat card tap
- [x] Haptic selection on carousel slide snap
- [x] Haptic selection on Season selection
- [x] Haptic notification-success on Crown reveal
- [x] Telegram's header colour and bottom bar colour are set to the app's palette
- [x] **Every** platform call is availability-guarded, so the prototype still works as a plain web page
      outside Telegram
- [x] The production app's existing dev-mode Telegram environment mock is used as the reference for
      running and verifying this outside Telegram
- [x] Not wired, deliberately: cloud storage, main button, secondary button, biometry, QR scanner, location
      manager, invoice, popup, home-screen prompt
- [x] Full verification suite green; lands as a single unpushed commit

## Comments

**Implemented behind one guarded platform boundary.** The prototype detects a complete TMA before SDK
initialization, and every feature operation uses the SDK's `ifAvailable` guard. The production Mini App's
existing development mock is reused rather than copied, with the same structurally complete launch data
its browser verification uses. A real production page with no Telegram globals resolves to no-op platform
methods; the Chat list, Leaderboard, carousel, and drawer all remained functional in that mode.

**Viewport state is Telegram-owned.** The SDK expands the viewport, binds its stable height and both safe
area families to CSS, and disables vertical swipes through `SwipeBehavior`. The prototype uses the greater
of Telegram's safe-area and content-safe-area inset on each edge. The portalled drawer carries the side and
bottom insets itself. At 390×844 the Telegram mock reported `isExpanded: true`,
`isVerticalEnabled: false`, and zero document scroll; injected nonzero insets appeared exactly as the four
computed paddings.

**Back has one listener and one predictable meaning.** A provider that survives Season navigation owns
the native button. It hides it on the Chat list and shows it on every Leaderboard route. The Season drawer
temporarily intercepts that listener to close itself. With the drawer closed it replaces the current route
with the Chat list, so it also behaves predictably after a direct Leaderboard entry; Season replacements do
not introduce a hide/show flicker between Seasons.

**Haptics follow outcomes rather than component internals.** Captured mock bridge events show medium
impact on a Chat tap, one selection change on a carousel snap, one selection change on a Season choice,
and one success notification when the active section reveals its Crown. A reveal id prevents React Strict
Mode from producing duplicate Crown notifications while still replaying them when a section becomes
active again.

**Telegram chrome uses the exact rendered background.** The stylesheet's near-black OKLCH background
resolves to `#100c18`; that RGB value is pushed to both the header and bottom bar. Content colours never
read `themeParams`.

**Verification.** `pnpm fmt:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm test` are green
(137 unit and integration tests plus 6 Chromium tests). No tests were added for this ticket, per the
implementation direction.
