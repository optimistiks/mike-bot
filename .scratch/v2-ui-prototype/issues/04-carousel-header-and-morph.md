# 04: Five sections as a full-bleed carousel, with header and Chat-card morph

**What to build:** A Member swipes horizontally through the five Leaderboard sections, one per screen,
using the gesture they already use everywhere else on a phone. They always know which section they are on,
because the section title stays pinned above the standings and the progress strip shows their position —
even when they have scrolled deep into a long list.

Tapping a Chat on the Chat list visually carries that card into the Leaderboard header, so arriving reads
as movement rather than a page being replaced.

**Blocked by:** 03

**Status:** resolved

- [x] The five sections render as a full-bleed horizontal carousel, one section per slide, in the fixed
      order ending on Как же у них горит
- [x] Roughly 12px of the next slide peeks at the screen edge so the swipe affordance is discoverable
      without instruction
- [x] Swiping past either end **rubber-bands and stops**; the carousel does not loop
- [x] The header has two tiers: Chat name and a tappable Season chip on the first, the section title and a
      pixel progress strip on the second
- [x] The section title **cross-fades** as slides change and never scrolls away, no matter how far down the
      standings the Member has scrolled
- [x] The progress strip shows which of the five sections is active
- [x] Top-level vertical scrolling does not exist; vertical scroll happens only inside a slide's standings
      list
- [x] A very long Chat name renders in the header without breaking the layout or truncating into
      ambiguity
- [x] Tapping a Chat morphs the Chat card into the Leaderboard header via React's `ViewTransition` shared
      element (Next.js 16.3 needs no configuration flag for this)
- [x] If the full card morph proves fiddly, fall back to morphing the avatar alone and note it on this
      ticket
- [x] Carousel and header are isolated composed components in their own files
- [x] Full verification suite green; lands as a single unpushed commit

## Comments

**The full card morph works; the avatar-only fallback was not needed.** The Chat
card and the header's whole first tier are the two ends of one
`<ViewTransition name={chatMorphName(chatId)} share="morph" default="none">`,
and the pair forms: during the navigation the browser reports
`::view-transition-group/-image-pair/-old/-new(chat-n1001000000003)`, so a real
morph runs rather than two independent cross-fades. `share="morph"` and
`default="none"` have to appear together — `default="none"` alone silently stops
the pair morphing — which is why both ends go through one `ChatMorph` component
rather than spelling the three props twice.

**The morph cost the Chat list its redirect hop.** Cards used to link at the
Season-less `/leaderboards`, which `redirect()`s to the Current Season. React
only pairs a morph when the destination renders in the same commit as the
navigation, and a redirect breaks that: the first attempt fired no view
transition at all. Cards now link straight at the Current Season's URL. The
Season-less route stays as a redirect for anyone who types it.

**Vertical scroll needed `.arcade` to have a definite height.** With
`min-height: 100dvh` the filmstrip → slide → scroll-container percentage chain
is indefinite, so every slide grew to fit its standings and the document
scrolled 120px. `height: 100dvh` closes the chain: `docScroll` is 0 on every
Season checked and the only thing that scrolls is a slide's own list.

**The 12px peek has to show content, not background.** The first pass kept the
slide's own 16px horizontal padding, so the 12px of the next slide on show was
12px of empty void — the affordance existed geometrically and was invisible. The
slide now carries no horizontal padding of its own and the standings' existing
6px is the whole inset, which puts a visible sliver of the next section's cards
inside the peek.

**Rubber-band is Embla's, measured rather than assumed.** Dragging 130px past
either end moves the track ~92px and releases back to the limit exactly
(0 at the head, -1500 at the tail), and `loop: false` means it never wraps.
`containScroll: "trimSnaps"` trims the last snap by the peek so the final
section sits flush against the screen edge instead of leaving a 12px gap.

**The Season chip opens the 8bitcn drawer, not a hand-rolled panel.** The first
pass gave the chip a bespoke absolutely-positioned disclosure with its own 15
lines of CSS; review caught it against the standing constraint that functional
primitives come from 8bitcn, and the drawer was already installed in ticket 01.
The chip is now a `DrawerTrigger` and ticket 02's bare Season index simply sits
inside the drawer. Ticket 05 replaces the contents — the year strip, the month
grid, the dimmed Seasons — and keeps the container.

**That surfaced a token-scoping bug.** The drawer portals its content to the end
of the document, outside `.arcade`, so everything inside it lost the whole
`--arcade-*` type scale and fell back to the browser's 16px. The tokens now sit
on `:root`; `.arcade` keeps only the layout. Ticket 05's drawer would have hit
this on its first render.

**The cross-fading title is a one-cell grid, not absolute positioning.** Both
titles stack in the same grid cell, so the box still sizes to the taller of them
and a title that wraps pushes the progress strip down instead of spilling over
it. Review flagged the absolute-positioned first pass as an overflow risk at
320px; the grid makes the question moot, and 320px was checked anyway.

**The progress strip is a cumulative fill, deliberately.** It is 8bitcn's
`Progress` in its retro variant at `(activeIndex + 1) / 5`, so the five sections
land on 4, 8, 12, 16 and 20 of its twenty squares. Review read that as "how far
through" rather than "which one is active"; both are true of it, the ticket asks
for a "pixel progress strip", and using the installed primitive beats
hand-rolling five cells. If it should instead read as five discrete lamps, that
is a design call worth raising rather than taking here.

**One acknowledged fragility.** `.arcade-filmstrip > div { height: 100% }`
reaches the Embla viewport by position, because 8bitcn's `CarouselContent`
renders it as an unclassed `<div className="overflow-hidden">` and forwards
`className` to the track inside it instead. Nothing else is a direct child of
`<Carousel>` here, so it is correct today and would break loudly rather than
silently if that changed.

Verified in the running app at iPhone 14 and at 320x640:

- All five sections swipe in the fixed order and end on Как же у них горит; the
  title cross-fades and the strip advances 4 squares a section.
- The header holds still with a slide scrolled 867px deep into an expanded
  twelve-entry list.
- The 42-character Chat name wraps to three lines beside an unshrunken Season
  chip.
- A pre-2024 Season renders the header over five empty slides and no error; the
  empty state itself is ticket 05's.
- The full-year view (`.../2024`) reads "2024 · ВЕСЬ ГОД" on the chip.
- No console errors on any of it.
