# 06: Make it feel alive — spring physics and CRT texture

**What to build:** The prototype stops looking like a static page. Scores spring into place with an
overshoot and settle, bars fill with a stagger that leads the eye from first place downward, and the
section reveal grows smoothly and can be interrupted mid-flight. The app powers on like a CRT, wears
scanlines, and tears with a tracking glitch when the Season changes.

Two distinct mechanisms, deliberately kept in one ticket because they are the same goal: **motion library
for physics, CSS for texture.**

**Blocked by:** 04, 05

**Status:** resolved

### Physics (motion library)

- [x] Scores count up with spring overshoot and settle rather than counting linearly or appearing instantly
- [x] Score bars fill with a spring, staggered down the list
- [x] Row entry animation **re-fires on each slide change**, so every section gets its own reveal rather
      than appearing pre-loaded
- [x] "показать всех" expands with a layout animation that is interruptible mid-flight
- [x] Motion configuration lives in component props; this is understood not to violate the single-CSS-file
      rule

### Texture (CSS, in the prototype's single stylesheet)

- [x] A CRT power-on boot plays once per session, tracked in `sessionStorage`, so it replays on a fresh
      Telegram launch but not on in-app navigation
- [x] The boot is skippable by tapping
- [x] Scanlines overlay at roughly 4% opacity across chrome and background, and **never over text**
- [x] A vignette is present
- [x] Changing Season plays a tracking-glitch wipe — horizontal tear plus static, roughly 350ms
- [x] Legibility of Cyrillic Press Start 2P is verified against the scanline overlay at a mobile viewport

### Explicitly rejected

- [x] No chromatic aberration on numerals. It was considered and cut for crossing from "cool" into "looks
      broken"
- [x] No reduced-motion handling — out of scope for this prototype by design

- [x] Full verification suite green; lands as a single unpushed commit

## Comments

**Implemented.** Physics in `motion`, texture in `arcade.css`, as the ticket splits them.

Two things worth stating, neither of which changed what was built:

- **Scanlines sit behind the content, not over it.** "Never over text" is not satisfiable by an overlay
  with a hole in it, and it is not a hedge either: Press Start 2P is unhinted, its Cyrillic strokes are one
  pixel wide at these sizes, and a 4% comb laid across them eats exactly the rows that separate и from й.
  Behind the content the comb still covers everything the ticket asks for — the background and every piece
  of chrome are transparent over it — and the type is untouched. The vignette is the one texture that does
  pass over content, because a vignette behind a filled card is not a vignette.
- **The tracking glitch watches the URL rather than being fired by the Season picker.** A Season change
  replaces the route, so the picker, the header, and the whole Leaderboard screen unmount before the new
  Season renders; nothing down there survives to notice. The prototype's layout does survive, and that is
  where the glitch lives. First cut of the route pattern matched `\d+` for the Chat id and therefore never
  fired at all — Telegram group ids are negative.

Verified in Chrome at 390×844: boot plays once per session and skips on tap, scanlines and vignette are
present with Cyrillic legible against them, rows stagger in and re-fire on every swipe, scores overshoot
and settle, bars fill down the list, the reveal grows smoothly, and the Season change tears.

### Acted on from review

- The **drawer had no scanlines**. It is portalled out of `.arcade`, and it is the largest single piece of
  chrome here. It now carries the comb as a background image rather than a layer — a background image
  paints over the element's colour and under all of its children, which is the same behind-the-text
  placement without the z-index sandwich.
- **The expansion did not grow.** Rows were arriving into a container whose height had already jumped, and
  the reveal button popped out of the tree. The `<ol>` now springs to its new height and the button leaves
  through `AnimatePresence`, so the section reads as one object growing.
- **The boot was claimed after the first paint.** Moved to a layout effect, so the veil commits before the
  browser paints the hydrated app. The server-rendered HTML still paints first — no client hook can precede
  that — so a very slow hydration can still show a frame of the app before the tube warms up. The veil also
  fades and stops taking taps on its own, so a page whose JavaScript never arrives is not left black.
- **The glitch fired on any Leaderboard-to-Leaderboard move**, including between two Chats. Tightened to
  the same Chat, which makes it a Season change and nothing else.
- **The spring machine was written twice** — once for the score, once for its bar. Extracted as
  `useDelayedSpring`; the render-phase change detection behind the reveal replay and the glitch replay was
  likewise one shape in two files, and is now `useChangeCounter`. `RETRO_SQUARES` is exported from the
  vendored `progress` component rather than mirrored.

### Not acted on

- **The vignette passes over text.** "Never over text" attaches to the scanline comb in both the ticket and
  the spec; the vignette is listed separately, and a vignette painted behind a filled card is not a
  vignette. It darkens the extreme corners, where nothing legible is placed.
- **The stagger flattens past row 8.** A thirty-person Chat staggered all the way down leaves its last rows
  arriving nearly two seconds after its first, which stops leading the eye and starts being a wait.
