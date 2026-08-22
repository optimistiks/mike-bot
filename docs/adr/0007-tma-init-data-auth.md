# Authenticate the Mini App with Telegram init data

The Mini App integrates with Telegram through `@tma.js/sdk-react` rather than the raw `telegram-web-app.js` global, and every protected request carries raw init data in an `Authorization: tma …` header. The server re-validates that signature per request and additionally requires the opener's Registration in the requested Chat, so a client that edits a start parameter or a Chat id gains nothing.

Init data is accepted for up to one year after its `auth_date`. That window is deliberately long: the surface is read-only leaderboards for one group of friends, and a short expiry would sign Members out mid-Season for no security gain worth the friction. Local development signs the same envelope with a separate dummy token so the app runs outside Telegram; production accepts only data signed by `BOT_TOKEN`.
