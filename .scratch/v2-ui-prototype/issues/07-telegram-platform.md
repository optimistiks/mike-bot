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

**Status:** ready-for-agent

- [ ] Viewport expands on launch and safe-area insets are respected, so nothing important sits under
      system chrome
- [ ] **Vertical swipe-to-dismiss is disabled** — scrolling a long standings list never closes the app.
      This is the highest-value integration in this ticket
- [ ] The native back button appears on the Leaderboard and is hidden on the Chat list
- [ ] With the Season drawer open, back **closes the drawer** and stays on the Leaderboard
- [ ] With the drawer closed, back returns to the Chat list — and because Season changes use replace, it
      does so in one press regardless of how many Seasons were browsed
- [ ] Haptic impact on Chat card tap
- [ ] Haptic selection on carousel slide snap
- [ ] Haptic selection on Season selection
- [ ] Haptic notification-success on Crown reveal
- [ ] Telegram's header colour and bottom bar colour are set to the app's palette
- [ ] **Every** platform call is availability-guarded, so the prototype still works as a plain web page
      outside Telegram
- [ ] The production app's existing dev-mode Telegram environment mock is used as the reference for
      running and verifying this outside Telegram
- [ ] Not wired, deliberately: cloud storage, main button, secondary button, biometry, QR scanner, location
      manager, invoice, popup, home-screen prompt
- [ ] Full verification suite green; lands as a single unpushed commit
