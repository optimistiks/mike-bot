# 06: Make it feel alive — spring physics and CRT texture

**What to build:** The prototype stops looking like a static page. Scores spring into place with an
overshoot and settle, bars fill with a stagger that leads the eye from first place downward, and the
section reveal grows smoothly and can be interrupted mid-flight. The app powers on like a CRT, wears
scanlines, and tears with a tracking glitch when the Season changes.

Two distinct mechanisms, deliberately kept in one ticket because they are the same goal: **motion library
for physics, CSS for texture.**

**Blocked by:** 04, 05

**Status:** ready-for-agent

### Physics (motion library)

- [ ] Scores count up with spring overshoot and settle rather than counting linearly or appearing instantly
- [ ] Score bars fill with a spring, staggered down the list
- [ ] Row entry animation **re-fires on each slide change**, so every section gets its own reveal rather
      than appearing pre-loaded
- [ ] "показать всех" expands with a layout animation that is interruptible mid-flight
- [ ] Motion configuration lives in component props; this is understood not to violate the single-CSS-file
      rule

### Texture (CSS, in the prototype's single stylesheet)

- [ ] A CRT power-on boot plays once per session, tracked in `sessionStorage`, so it replays on a fresh
      Telegram launch but not on in-app navigation
- [ ] The boot is skippable by tapping
- [ ] Scanlines overlay at roughly 4% opacity across chrome and background, and **never over text**
- [ ] A vignette is present
- [ ] Changing Season plays a tracking-glitch wipe — horizontal tear plus static, roughly 350ms
- [ ] Legibility of Cyrillic Press Start 2P is verified against the scanline overlay at a mobile viewport

### Explicitly rejected

- [ ] No chromatic aberration on numerals. It was considered and cut for crossing from "cool" into "looks
      broken"
- [ ] No reduced-motion handling — out of scope for this prototype by design

- [ ] Full verification suite green; lands as a single unpushed commit
