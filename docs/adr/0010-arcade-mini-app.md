# Build the Mini App as an arcade toy, not a dashboard

Mike-bot is a joke app whose entire audience is one group of friends, so the Mini App commits to an arcade identity instead of the neutral, theme-adaptive interface a product for strangers would get: Press Start 2P at every size with no second typeface, neon-on-black, scanlines and vignette, a CRT power-on boot, a tracking-glitch wipe when the Season changes, and spring count-ups on every score. The personality is the product; a tasteful admin dashboard would be a worse answer to "who got the chicken this month".

It therefore rejects Telegram's guidance to adopt `themeParams` for content colours, and instead pushes its own palette outward into Telegram's header and bottom bar so the Mini App reads as one object rather than a website embedded in a chat client.

Accepted costs, each chosen rather than overlooked: no light mode, no dark mode, no `prefers-color-scheme`, no reduced-motion support, and accessibility deprioritised where it fights the layout. All bespoke CSS lives in one file so the whole look can be read — or deleted — in one action. If Mike-bot ever serves people who are not friends of the author, every line of this decision is worth reopening.
