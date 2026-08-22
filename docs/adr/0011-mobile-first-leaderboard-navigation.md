# Navigate Leaderboards by carousel and Season drawer, and change Season with replace

Leaderboards are read on a phone, so a Leaderboard's five sections are a full-bleed horizontal carousel — one section per screen, a peek of the next to advertise the gesture, rubber-band resistance instead of looping, explicit arrows for fine pointers — rather than five stacked lists or a table whose columns a long Display identity would destroy. Each standings entry stacks rank, avatar, flair, and score over a full-width wrapping name, so a name is never truncated. Seasons are chosen in a bottom drawer (year strip, month grid, "СЕЙЧАС" and "ВЕСЬ ГОД" shortcuts) rather than dropdowns.

Every Leaderboard period has exactly one URL, `/chats/[chatId]/leaderboards/[year]/[month]` for a Season and `/chats/[chatId]/leaderboards/[year]` for a year, and "current" is a highlighted state rather than a separate page. Season changes navigate with **replace**, not push, so back always means "return to the Chat list" instead of walking backwards through every Season just browsed; undoing a Season change is served by reopening the drawer.

The Telegram platform is used to make this safe: vertical swipe-to-dismiss is disabled so scrolling a long standings list cannot close the app, the native back button drives the drawer and the Chat list, the viewport opens expanded with safe-area insets, and haptics fire on selection.

The carousel's cost is that four of five sections are behind a gesture. The peek, the snap haptic, and the arrows are the mitigation; if it still reads as undiscoverable in hand, this is the decision to revisit.
