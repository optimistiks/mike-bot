# Spec: v2 Mini App leaderboards prototype

Status: ready-for-agent

## Problem Statement

Mike-bot's Mini App works but looks like a homework assignment: an unstyled chat picker, five stacked
`<ol>`s, and two native `<select>` elements for choosing a Season. It is a joke app that friends open to
find out who got crowned and who got the chicken this month, and nothing about the current interface
rewards opening it.

There is a pre-prototype at `apps/web/app/(prototypes)/prototypes/v2-ui/` that gestures at a direction —
8bitcn pixel components, a neon-on-black arcade palette, Press Start 2P — but it is a static sketch. It
hardcodes five entries per section, ships a chart nobody specified the meaning of, navigates Seasons with
two dropdowns, uses a desktop two-column grid on an interface that is overwhelmingly used on a phone, and
renders standings as tables whose columns cannot survive a long Display identity. It does not touch the
Telegram Mini App platform at all: no back button, no haptics, no viewport handling, no swipe-behavior
control — so scrolling a long leaderboard can accidentally dismiss the whole app.

We need to know what the v2 Mini App should actually look and feel like before building it for real.

## Solution

Rebuild the pre-prototype in place as a single, opinionated, mobile-first prototype of the Mini App: a
Chat picker that morphs into a Chat's Leaderboard, five Leaderboard sections presented as a full-bleed
swipeable filmstrip, and a Season picker drawer that reaches any Season in one gesture.

The prototype commits hard to an arcade identity — pixel type, neon-on-black, scanlines, a CRT boot, a
tracking-glitch wipe when the Season changes — and pushes that palette outward into Telegram's own chrome
rather than adopting Telegram's theme. It uses the Telegram Mini App platform deliberately: native back
button, haptics on every meaningful interaction, expanded viewport with safe-area insets, and vertical
swipe-to-dismiss disabled so scrolling a leaderboard never closes the app.

Every score animates in with spring physics. Every Display identity gets its own full-width line so no
name is ever truncated. Data is deterministic and generated on the server, shaped exactly like the real
`/api/leaderboard` response, so the finished prototype can be pointed at production data later without
rewriting a component.

This is a throwaway prototype whose job is to answer "is this the interface we want to build?" — not to
ship.

## User Stories

### Choosing a Chat

1. As a Member, I want to land on a list of my Chats when I open the Mini App, so that I can pick which
   group's standings I care about right now.
2. As a Member, I want each Chat shown with its avatar and name, so that I can recognise the group at a
   glance.
3. As a Member in a Chat with a very long name, I want that name rendered in full rather than cut off, so
   that I can tell two similarly-named Chats apart.
4. As a Member, I want tapping a Chat to feel physical — a haptic tap and the Chat card visually becoming
   the Leaderboard header — so that the app feels like a place I moved through rather than a page that was
   replaced.
5. As a Member opening the Mini App for the first time in a session, I want a short CRT power-on
   animation, so that the app announces its personality before it announces its data.
6. As a Member who has seen the boot animation before, I want to be able to tap to skip it, so that the
   personality never costs me time when I just want the numbers.

### Reading a Leaderboard

7. As a Member, I want to see which Chat and which Season I am looking at, pinned at the top of the
   screen, so that I never misread one Season's standings as another's.
8. As a Member, I want the current section's title to stay visible while I scroll deep into its standings,
   so that I always know which of the five boards I am reading.
9. As a Member, I want to swipe horizontally between the five sections, so that I can move through the
   whole Leaderboard with the gesture I already use everywhere else on my phone.
10. As a Member, I want to see the edge of the next section peeking at the side of the screen, so that I
    discover the swipe affordance without being told.
11. As a Member, I want a progress indicator showing which of the five sections I am on, so that I know
    how much of the Leaderboard I have seen.
12. As a Member, I want a haptic tick each time a section snaps into place, so that swiping feels
    mechanical and deliberate.
13. As a Member who swipes past the last section, I want the carousel to bounce back rather than wrap
    around to the first, so that I can tell I have reached the end.
14. As a Member, I want the sections in a fixed, meaningful order — received Karma, received Humor, Karma
    plus given, Humor given, Karma minus given — so that the Leaderboard reads as one story ending on the
    burn.

### Reading standings

15. As a Member, I want each entry to show rank, avatar, Display identity, and score, so that I can find
    myself and see where I stand.
16. As a Member with a long Display identity, I want my name on its own full-width line where it can wrap
    freely, so that it is never truncated into unreadability.
17. As a Member, I want each entry's score accompanied by a bar proportional to the section leader's
    score, so that I can see the shape of the standings without reading every number.
18. As a Member, I want scores to spring into place with a slight overshoot rather than appearing
    instantly, so that the reveal feels like a scoreboard settling.
19. As a Member, I want the entry bars to fill in with a stagger down the list, so that my eye is led from
    first place downward.
20. As a Member, I want the row animation to replay when I swipe to a new section, so that each section
    gets its own reveal rather than appearing pre-loaded.
21. As a Member who is a Crown holder, I want a crown on my entry, so that my victory is visible.
22. As a Member who is a Chicken, I want a chicken on my entry, so that my defeat is equally visible.
23. As a Member, I want every Member tied for the top of a section to receive a Crown, so that the flair
    matches how scoring actually works rather than arbitrarily picking one winner.
24. As a Member in a large Chat, I want the first several entries shown with the remainder behind a
    "показать всех" reveal, so that a thirty-person Chat does not bury the top of the standings.
25. As a Member, I want the section to grow smoothly when I reveal the rest, so that the list expanding
    reads as one continuous object rather than a jump.
26. As a Member, I want to interrupt that expansion mid-animation, so that the interface never feels like
    it is making me wait.

### Navigating Seasons

27. As a Member, I want to land on the Current Season by default, so that the most relevant standings need
    zero interaction.
28. As a Member, I want to tap the Season shown in the header to open a Season picker, so that changing
    Season is discoverable from the thing it changes.
29. As a Member, I want the Season picker as a bottom drawer I can drag down to dismiss, so that closing
    it costs no aim.
30. As a Member, I want the drawer to resist and then release when I drag it, so that dismissing feels
    physical rather than binary.
31. As a Member, I want to pick a year from a horizontal strip and a month from a grid, so that I can
    reach any Season in one tap after opening the drawer.
32. As a Member, I want a "СЕЙЧАС" option, so that returning to the Current Season is always one tap
    regardless of where I have wandered.
33. As a Member, I want a "ВЕСЬ ГОД" option, so that I can see how a whole year shook out rather than only
    month by month.
34. As a Member, I want Seasons with no data shown dimmed in the picker, so that I do not tap into empty
    screens.
35. As a Member, I want a haptic response when I select a Season, so that the selection registers before
    the screen updates.
36. As a Member, I want changing Season to play a tracking-glitch wipe, so that the change of data is
    unmistakable rather than a silent content swap.
37. As a Member, I want a year's totals to equal the sum of that year's months, so that the two views
    never contradict each other.
38. As a Member viewing a Season with no Events, I want a clear empty state rather than five blank
    sections, so that I understand there is nothing to see rather than assuming the app broke.

### Moving around

39. As a Member, I want Telegram's native back button to appear on the Leaderboard, so that leaving uses
    the affordance I already know.
40. As a Member with the Season drawer open, I want back to close the drawer rather than leave the
    Leaderboard, so that back never overshoots.
41. As a Member who has changed Season several times, I want back to return me to the Chat list rather than
    walking me backwards through every Season I looked at, so that back means one predictable thing.
42. As a Member scrolling a long list of standings, I want vertical swipe never to dismiss the Mini App, so
    that reading the Leaderboard is not a hazard.
43. As a Member, I want the Mini App to open expanded to full height, so that I am not reading standings
    through a half-height window.
44. As a Member on a device with a notch or home indicator, I want content inset clear of them, so that
    nothing important sits under system chrome.
45. As a Member, I want Telegram's header and bottom bar to match the app's palette, so that the Mini App
    reads as one object rather than a website embedded in a chat client.

### Working on the prototype

46. As a developer, I want the prototype's data shaped exactly like the real Leaderboard API response, so
    that pointing it at production data later requires no component changes.
47. As a developer, I want fixture data generated on the server, so that a 2MB data library never reaches a
    phone.
48. As a developer, I want fixture data deterministic across reloads, so that reviewing a design change
    never means comparing two different datasets.
49. As a developer, I want every new component to be a small, named, composable file, so that the prototype
    remains legible when we harvest parts of it for the real app.
50. As a developer, I want all bespoke CSS in one file, so that I can read the entire visual system in one
    sitting and delete it in one action.

## Implementation Decisions

### Scope and location

- The prototype is rebuilt **in place** at the existing pre-prototype location. No new prototype directory,
  no parallel variants. One prototype.
- It lives under the existing prototypes route group and shares that group's layout and global stylesheet.
  It is dev-facing only and is never linked from the production Mini App.
- All copy is Russian.
- Mobile-first throughout. The phone is the target; wider viewports need only not break.

### Route shape

- The prototype root redirects to the Chat list.
- Chat is part of the URL: the Leaderboard route is scoped by Chat id, then year, then an optional month.
  A Leaderboard cannot be rendered without knowing its Chat (per ADR 0009, everything is Chat-scoped), so
  the Chat must be addressable.
- A bare Leaderboard route with no Season redirects to the Current Season's year and month. There is
  exactly one URL per Season; "current" is a highlighted state, not a separate page.
- Season changes navigate with **replace**, not push. Back therefore always means "return to the Chat
  list" rather than "undo one of the six Seasons you just browsed". Undoing a Season change is served by
  reopening the picker.
- The full-year view is a real destination with a month-less URL.

### Domain alignment

- The five section titles are the pre-prototype's, not production's, and their mapping to buckets is fixed:
  - Уважаемые люди → Karma received
  - Юмористы → Humor received
  - На позитиве → Karma plus given
  - Хотят смеяться 5 минут → Humor given
  - Как же у них горит → Karma minus given
- Section order is exactly the order above, deliberately different from production's ordering so the
  Leaderboard ends on the Karma-minus section.
- The prototype does **not** modify production's section titles in the scoring module. Reconciling the two
  name sets is a separate decision for later.
- Crown and Chicken remain tie-inclusive per the domain glossary: every Member tied for the highest total
  receives a Crown. The prototype's fixtures must produce at least one multi-way Crown tie so the layout
  is exercised.
- **Known domain gap, accepted deliberately:** the glossary defines a Season as a single calendar month,
  and the production Leaderboard API rejects a year without a month. The full-year view therefore
  describes something the backend cannot currently produce. This is an acknowledged implementation gap —
  the domain model and API will be extended later. The prototype builds it now to answer the design
  question.
- Display identities are rendered as Telegram `@handle`-style strings. Note the glossary defines Display
  identity as "the latest known name used to present a Member within one Chat", which in production may be
  a full name rather than a handle. The layout must survive both, which is precisely why names get their
  own full-width wrapping line.

### Page composition

- **Chat list**: four Chats, each an avatar and a name. Nothing else — no member counts, no teaser stats,
  no sparklines.
- **Leaderboard header, two tiers**: Chat name and a tappable Season chip on the first line; a persistent
  section title on the second line that cross-fades as the carousel moves, with a pixel progress strip
  beneath it. The section title must not scroll away.
- **Sections as a full-bleed horizontal carousel**: five slides, one section each, roughly 12px of the next
  slide peeking to advertise the gesture, rubber-band resistance at both ends, **no looping**. Top-level
  vertical scrolling does not exist; vertical scroll happens only inside a slide's standings list.
- **Standings entry, three stacked lines** — explicitly not a table row:
  - Line 1: rank chip, avatar, and Crown/Chicken flair. Short, fixed-width things only.
  - Line 2: the full Display identity, full width, wrapping freely, never truncated.
  - Line 3: score plus a bar proportional to the section leader's score.
  Roughly six entries fit a screen; the remainder sit behind a "показать всех" reveal.
- **Season picker**: a bottom drawer containing a horizontal year strip over a 3×4 month grid, plus
  persistent "ВЕСЬ ГОД" and "СЕЙЧАС" cells. Months with no data render dimmed.

### Visual direction

- The prototype **rejects Telegram's `themeParams` for content colours** and commits to the arcade palette
  already present in the prototype group's stylesheet (neon violet/magenta on near-black, cyan glow). This
  is a deliberate departure from Telegram's design guidance, justified by the app being a joke app for
  friends whose identity is the point.
- Rather than the app matching Telegram's chrome, the app **pushes its palette outward** into Telegram's
  chrome via the Mini App header and bottom-bar colour APIs.
- No light mode, no dark mode, no `prefers-color-scheme` handling. One committed look.
- Press Start 2P is the only typeface, at every size. No secondary font. Long handles wrapping to three
  lines is an accepted, designed-for outcome — Line 2 exists to absorb exactly that. If a specific handle
  proves unbearable, the remedy is a size step on the name, never a second family.
- `typeset` is **deleted outright** — the stylesheet file, its import from the prototype group's global
  stylesheet, and its classes on `<body>`. It is a prose stylesheet that forces flow margins on every
  paragraph and heading, which actively fights a card-based app UI. The 8bitcn kitchen-sink pages lose
  their prose styling as a consequence; this is accepted.

### Motion

Physics, via the motion library:

- Spring count-up on scores, with overshoot and settle.
- Layout animation on the "показать всех" reveal; interruptible mid-flight.
- Staggered spring entry of standings rows, re-firing on each slide change.
- Spring-driven fill on the score bars.

Texture, via CSS:

- Scanline overlay at roughly 4% opacity, over chrome and background only — **never over text**.
- Vignette.
- Tracking-glitch wipe on Season change: horizontal tear plus static, roughly 350ms.
- CRT power-on boot, once per session (tracked in `sessionStorage`, so it replays on a fresh Telegram
  launch but not on in-app navigation), skippable by tapping.

Navigation:

- React's `ViewTransition` for the Chat card → Leaderboard header shared-element morph. Next.js 16.3
  requires no configuration flag for this. If the morph proves fiddly, fall back to morphing the avatar
  alone.

Explicitly rejected: **chromatic aberration on numerals**. It crosses from "cool" into "is this broken".

### Telegram Mini App platform

Wired, every call guarded by the SDK's availability check so the prototype degrades to a working web page
outside Telegram:

- Viewport expand, plus safe-area inset CSS variables.
- **Vertical swipe-to-dismiss disabled** — the highest-value integration here, since without it scrolling a
  long leaderboard can close the app.
- Back button: closes the Season drawer if open, otherwise navigates back.
- Haptics: impact on Chat card tap, selection on carousel snap and Season selection, notification-success
  on Crown reveal.
- Mini App header colour and bottom-bar colour set to the app's palette.

Explicitly **not** wired: cloud storage (it would make demos non-deterministic), main button, secondary
button, biometry, QR scanner, location manager, invoice, popup, home-screen prompt.

The existing dev-mode Telegram environment mock in the production app is the reference for running this
outside Telegram.

### Data

- `@faker-js/faker`, seeded, as a **devDependency**. Legitimate because it runs server-side only in a
  prototype that is never deployed.
- **Generated on the server** and passed to client components as plain arrays. Faker must never enter the
  browser bundle.
- Roughly 12 Members per Chat, generating `@handle`-style Display identities via faker's username
  generator — which naturally yields the occasional 25-character monster the layout must survive.
- The Member roster is **fixed across Seasons**. A group chat's membership does not churn monthly.
- Scores are reseeded per year and month, so Crowns and Chickens move between Seasons and the picker
  visibly does something.
- **A year's totals are the sum of its months.** A prototype whose year contradicts its months will
  confuse someone in review.
- Nothing before 2024-01, so the empty-Season state is reachable and the month grid has dimmed cells to
  demonstrate.
- The four Chat names are **hand-written Russian**, including one deliberately punishing long one. Faker's
  ru locale exists but produces corporate-sounding company names, not friends' group chat names. The ru
  locale is not used anywhere.
- **The fixture builder returns the same shape as the production Leaderboard API response** — the section
  and entry schema already defined in the leaderboard module. This is the single seam: components consume
  the production shape, so pointing them at the real endpoint later requires no component changes.

### Dependencies

Three new runtime dependencies enter a workspace that currently has zero of them, each with a reason it
could not be avoided:

- **Embla**, via the 8bitcn carousel component. Native CSS scroll-snap was considered and rejected: it
  provides no selected-index, so driving the progress strip and snap haptics would have meant
  hand-rolling an IntersectionObserver.
- **Vaul**, via the 8bitcn drawer component. Drag-to-dismiss with rubber-band resistance and
  velocity-based dismissal is exactly what vaul exists for; building it by hand would violate the
  don't-reinvent-the-wheel rule.
- **motion**, for the four physics behaviours above, none of which Embla or vaul provide.

8bitcn components to install: **carousel**, **drawer**, **toggle-group** (year strip and month grid),
**xp-bar** (the score bar). Already vendored and reused as-is: avatar, badge, button, card, item,
separator, skeleton, empty.

The score bar uses **xp-bar** rather than the generic progress component: a literal XP bar is both the
funnier and the more semantically correct choice for a leaderboard about earning points from friends. If
xp-bar turns out to be rigid or to fight a spring-driven value, fall back to the progress component and
say so.

### Deletions

- The pulse/chart section is **removed entirely**. It was in the original brief and was dropped during
  design: no chart of any kind appears in this prototype. Recharts goes unused by it.
- The two-`<select>` Season navigation component is deleted, replaced by the drawer.
- The typeset stylesheet is deleted as described above.

### Standing constraints

These are durable rules for the implementation, not just conventions from the design conversation:

- **All bespoke CSS in one file**, imported once by the prototype's layout. Nothing added to the prototype
  group's global stylesheet, nothing scattered across component files. Motion configuration lives in
  component props, which is understood not to violate this.
- **Functional components come from 8bitcn.** Do not build functional primitives — selects, drawers,
  carousels, progress bars — from native elements or from scratch. New components are layout and
  organisational components that compose 8bitcn primitives.
- **Every new component is a meaningful, isolated, named file.** No div soup inside page components. Use
  composition.
- **Need a library? Raise it.** Do not start reimplementing a wheel. If a capability seems to need a
  dependency, surface the decision rather than hand-rolling.
- **One commit per ticket.** Each ticket lands as a single commit on `v2-user-ui-prototypes`, with the
  full verification suite green before that commit is made. Nothing is pushed.
- **The stop-and-raise rule.** If two different approaches to something both fail, zoom out and ask
  whether it is even a problem worth solving: is there a library for it, is a different part of the system
  actually responsible, should it be dropped? If all of that fails, **stop and raise an issue.** Do not
  grind.

This rule fired twice during design and should be expected to fire during implementation: a hand-rolled
drag-to-dismiss was retracted in favour of vaul, and the xp-bar → progress fallback was pre-declared.

## Testing Decisions

**No automated tests.** This is a throwaway prototype built to answer a design question. Tests would
outlive the thing they test and would pin down decisions the prototype exists to keep loose.

What still applies:

- The repo's mandated verification suite must pass clean before **every** commit: format check, lint,
  typecheck, build, and the existing test run. Warnings count as failures. Each ticket commits once, so
  every ticket boundary is a green checkpoint.
- The prototype must not break any existing test. The production Mini App, the scoring module, and the API
  routes are untouched, so nothing should regress — but the shared prototype-group layout and global
  stylesheet are edited (typeset removal), so the 8bitcn kitchen-sink routes must still build and render.

**Verification method**: drive the running dev server with browser automation plus the Next.js devtools
MCP, at a mobile viewport. Walk the Chat list, each of the five sections, the Season drawer, a full-year
Season, an empty Season, and the long-Chat-name and long-Display-identity cases. Screenshots are not
required as a deliverable — the developer will look themselves.

**On the one seam that exists**: the fixture builder returning the production `LeaderboardResponse` shape
is the highest and only sensible seam in this work. If tests are ever wanted here later, that boundary is
where they go, and it already exists in the production leaderboard schema module rather than being
invented for the prototype.

**Prior art** for browser-level verification: the production Mini App's browser tests and the dev-mode
Telegram environment mock, both in the production app directory. They are the reference for how this repo
drives a Telegram Mini App outside Telegram — not a template to copy tests from.

## Out of Scope

- **Any chart.** The "chat pulse" from the original brief was cut during design. No pulse, no sparkline, no
  chart component anywhere in this prototype.
- **Production code changes.** The scoring module's section titles, the leaderboard API, the database, the
  bot, and the production Mini App at the app root are all untouched.
- **Extending the domain model.** The full-year Leaderboard is prototyped as an acknowledged gap; actually
  defining a year-scoped Season in the glossary and implementing it in the API is separate work.
- **Accessibility and WCAG.** Explicitly deprioritised for this prototype. Existing skip links and ARIA in
  the pre-prototype may be dropped where they complicate layout.
- **Reduced-motion support.** Explicitly out. The motion is the point.
- **Light mode, dark mode, and Telegram `themeParams` adoption.** One committed palette.
- **Real data, authentication, Registration checks, and API wiring.** The prototype renders fixtures.
- **Deployment.** Nothing here is deployed anywhere.
- **Alternate prototype variants.** One prototype, not three.
- **Cloud storage, main button, biometry, QR scanning, location, invoices, popups, and home-screen
  prompts** from the Telegram SDK.
- **Tests.**

## Further Notes

**The riskiest decision** is the full-bleed carousel. It is the mobile-native gesture and it gives each
section a whole screen, but it hides content: a friend may never discover the fifth section. Mitigations
are baked in — the 12px peek, the progress strip, the snap haptics. If it still reads as undiscoverable
once it is in hand, the fallback is a vertically stacked snap-scroll of the five sections, which changes
layout only and leaves data, motion, and platform integration untouched. That fallback should be raised as
a finding, not silently taken.

**On deliberately violating Telegram's design guidance**: Telegram's Mini App documentation is emphatic
that apps should adopt `themeParams` so they feel native inside the client. This prototype does the
opposite, on purpose, for a joke app whose identity is the whole product. The compromise — pushing our
palette outward into Telegram's chrome rather than ignoring the chrome — is what keeps it from looking
like a website embedded in a chat window. If this ever becomes a real product for people who are not
friends of the author, revisit it.

**On the dependency count**: three runtime dependencies for a throwaway prototype is a lot. Each was
argued individually rather than adopted as a bundle, and each has a stated reason a native approach was
rejected. If the prototype is later harvested for production, Embla and vaul come along with the
components that need them; motion is the one worth re-examining, since its four uses are all
straightforward enough that CSS could carry them at some cost in polish.

**On the production/prototype name divergence**: this prototype uses funnier section titles than
production ships. That divergence is a live inconsistency in the codebase until someone reconciles it.
Worth a follow-up ticket once the prototype has served its purpose.

**Origin**: this spec is the output of a design grilling session. Decisions here were argued and settled
rather than assumed, including two the author reversed mid-session (the pulse chart, dropped entirely; the
motion library, initially rejected then adopted).
