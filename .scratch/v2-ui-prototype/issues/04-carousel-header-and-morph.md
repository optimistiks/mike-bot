# 04: Five sections as a full-bleed carousel, with header and Chat-card morph

**What to build:** A Member swipes horizontally through the five Leaderboard sections, one per screen,
using the gesture they already use everywhere else on a phone. They always know which section they are on,
because the section title stays pinned above the standings and the progress strip shows their position —
even when they have scrolled deep into a long list.

Tapping a Chat on the Chat list visually carries that card into the Leaderboard header, so arriving reads
as movement rather than a page being replaced.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] The five sections render as a full-bleed horizontal carousel, one section per slide, in the fixed
      order ending on Как же у них горит
- [ ] Roughly 12px of the next slide peeks at the screen edge so the swipe affordance is discoverable
      without instruction
- [ ] Swiping past either end **rubber-bands and stops**; the carousel does not loop
- [ ] The header has two tiers: Chat name and a tappable Season chip on the first, the section title and a
      pixel progress strip on the second
- [ ] The section title **cross-fades** as slides change and never scrolls away, no matter how far down the
      standings the Member has scrolled
- [ ] The progress strip shows which of the five sections is active
- [ ] Top-level vertical scrolling does not exist; vertical scroll happens only inside a slide's standings
      list
- [ ] A very long Chat name renders in the header without breaking the layout or truncating into
      ambiguity
- [ ] Tapping a Chat morphs the Chat card into the Leaderboard header via React's `ViewTransition` shared
      element (Next.js 16.3 needs no configuration flag for this)
- [ ] If the full card morph proves fiddly, fall back to morphing the avatar alone and note it on this
      ticket
- [ ] Carousel and header are isolated composed components in their own files
- [ ] Full verification suite green; lands as a single unpushed commit
