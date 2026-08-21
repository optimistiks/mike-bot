# 03: The three-line standings entry

**What to build:** A Member reading a section sees each participant as a card, not a table row. Rank,
avatar, and Crown/Chicken flair sit together on the first line; the Display identity gets the entire second
line to itself and wraps as many times as it needs; the score and a bar proportional to the section leader
occupy the third. No Display identity is ever truncated, however long it is.

Long sections do not bury the top: roughly the first six entries show, with the rest behind a "показать
всех" reveal.

The table-and-column layout is deliberately abandoned here — columns cannot survive an arbitrary-length
Display identity, which is the whole reason for the stacked shape.

**Blocked by:** 02

**Status:** resolved

- [x] Each entry renders as three stacked lines, not a table row
- [x] Line 1 holds only short fixed-width things: rank chip, avatar, and Crown/Chicken flair
- [x] Line 2 is the full Display identity at full width, wrapping freely, **never** truncated or
      ellipsised
- [x] A ~25-character `@handle` wraps to multiple lines and remains fully readable
- [x] Line 3 holds the score plus a bar whose length is proportional to that section's leading score
- [x] The score bar uses the 8bitcn `xp-bar`. If `xp-bar` proves rigid or fights a driven value, fall back
      to the generic progress component **and say so in a comment on this ticket** — do not grind
- [x] Every Member tied for a section's highest total receives a Crown; the multi-way tie from ticket 02
      renders correctly with multiple crowns
- [x] Roughly six entries are visible before the reveal; the remainder appear behind "показать всех"
- [x] Entry cards are meaningful isolated components in their own files, composing 8bitcn primitives — no
      div soup inside page components
- [x] All bespoke CSS goes in the prototype's single stylesheet
- [x] Full verification suite green; lands as a single unpushed commit

## Comments

**The `xp-bar` → `progress` fallback was taken.** The spec pre-declared it and
`xp-bar` earned it: every section leader sits at exactly 100, and `xp-bar`
answers 100 with a "LEVEL UP!" overlay plus a permanent `animate-pulse` that no
prop can disable — only `levelUpMessage=""` empties the text, leaving the pulse.
On this page that was eight bars throbbing like loading skeletons, and once
ticket 06 springs the value through 100 with overshoot it would have flickered on
every reveal. That is the ticket's "fights a driven value" verbatim. Two further
rigidities: `xp-bar` sets `progressBg="bg-yellow-500"` *after* spreading props,
so the fill colour is unreachable, and it keeps `className` on its own wrapper
rather than forwarding it, so the height hook `progress` exposes is unreachable
too. It also renders a duplicate `<style>` block per instance — 30 of them on
this page, down to 1 after the swap.

`progress` is what `xp-bar` wraps, so the retro squares are unchanged, and its
default fill is the palette's own primary. A first pass gave the bar a gold fill
instead; review caught that as inventing a third brand hue in a spec that says
"One committed look", and it was reverted. If a distinct colour for the bar is
wanted, that is a design decision to raise, not one to take in a comment.

**The filled rank chip follows the Crown, not rank 1.** The first pass keyed it
to `rank === 1`, which review caught: in ticket 02's Юмористы tie both entries
carry Crowns but only one would have carried the filled chip — contradicting the
very tie-inclusive rule the flair exists to show.

**The bar needed its width handed to it.** Every box inside `progress` is
`w-full`, so as a flex child it collapsed to zero and rendered as an empty
frame. `min-w-0 flex-1` on the bar is what makes line 3 work.

**Line 2 is `arcade-text-md`, a size up from line 1.** Not to force the wrap —
review rightly pointed out the ticket asks that a long handle stay readable when
it wraps, not that it must wrap. The reason is that the Display identity is the
entry's primary content and should not be the smallest thing on the card while
the number beside it is larger. Six entries still fit a 390x844 screen at this
size, so the density the spec asks for is intact. `overflow-wrap: anywhere`
rather than `break-word`, because a handle is one unbroken token between its dots
and underscores.

**Two edges left as they are, deliberately.** `progress`'s retro variant
quantises to twenty squares, so bar length is proportional in 5% steps and two
close scores can draw the same bar — that coarseness is the pixel look, not a
defect. And when a section's leader is at zero or below there is no positive
scale to draw against, so every bar in it renders empty rather than inverted;
`rankBucket` filters zero scores out, so reaching this needs a section where
every Member is negative.

**`Item` supplies the three lines.** `ItemHeader` and `ItemFooter` are already
`basis-full` inside a wrapping flex `Item`, so the stacked shape falls out of
8bitcn's own primitive rather than being imposed on it. Rank is a `Badge` padded
to two digits so crossing 9 to 10 never reflows line 1.

Verified in the running app at an iPhone 14 viewport:

- Chat `-1001000000001`, 2024-03: six entries then "показать всех", which
  reveals all twelve and removes itself.
- The same Season's Юмористы renders the ticket-02 Crown tie as two Crowns at 33.
- Rank 12 at 11 points carries the Chicken.
- The full-year view (`.../2024`) puts three-digit scores in the fixed-width
  score column without shifting the bars' left edge.
- A pre-2024 Season renders five empty lists and no error. The empty state
  itself belongs to ticket 05.
