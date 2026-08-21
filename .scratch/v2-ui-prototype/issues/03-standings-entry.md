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

**Status:** ready-for-agent

- [ ] Each entry renders as three stacked lines, not a table row
- [ ] Line 1 holds only short fixed-width things: rank chip, avatar, and Crown/Chicken flair
- [ ] Line 2 is the full Display identity at full width, wrapping freely, **never** truncated or
      ellipsised
- [ ] A ~25-character `@handle` wraps to multiple lines and remains fully readable
- [ ] Line 3 holds the score plus a bar whose length is proportional to that section's leading score
- [ ] The score bar uses the 8bitcn `xp-bar`. If `xp-bar` proves rigid or fights a driven value, fall back
      to the generic progress component **and say so in a comment on this ticket** — do not grind
- [ ] Every Member tied for a section's highest total receives a Crown; the multi-way tie from ticket 02
      renders correctly with multiple crowns
- [ ] Roughly six entries are visible before the reveal; the remainder appear behind "показать всех"
- [ ] Entry cards are meaningful isolated components in their own files, composing 8bitcn primitives — no
      div soup inside page components
- [ ] All bespoke CSS goes in the prototype's single stylesheet
- [ ] Full verification suite green; lands as a single unpushed commit
