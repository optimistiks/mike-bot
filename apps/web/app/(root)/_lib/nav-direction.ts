/**
 * Which way the next page transition travels, published as a class on `<html>`.
 *
 * React can carry this for us — a transition type maps to a `view-transition-class`
 * on the pseudo-elements, and `arcade.css` used to select on `.nav-forward` /
 * `.nav-back`. That form is unusable here: `view-transition-class` needs Safari
 * 18.2 or Chrome 125, and the Telegram clients run older WebViews than that. The
 * class silently fails to match, every rule below it is dropped, and the two page
 * snapshots fall back to the user agent's 250ms cross-fade — which reads as the
 * destination cutting in whole while the Chat header morphs on top of it.
 *
 * A class on the root element is the oldest selector there is, and the
 * `::view-transition-*` pseudo-elements hang off that same root, so
 * `html.nav-forward::view-transition-old(page-chats)` works everywhere the View
 * Transition API itself works.
 */

const DIRECTIONS = ["nav-forward", "nav-back"] as const;

export type NavDirection = (typeof DIRECTIONS)[number];

/**
 * Call this synchronously in the same event that navigates. The class only has
 * to be on the root by the time the browser styles the pseudo-elements, which is
 * after React has started the transition, so setting it just before the
 * `router` call is early enough.
 *
 * Nothing clears it on a timer. A timer would have to guess how long the
 * transition lasts, and losing that race mid-flight strands both snapshots
 * half-animated on screen. The class is inert between navigations — the
 * pseudo-elements it selects only exist during a transition — so it is simply
 * left in place until the next navigation states its own direction, or until
 * `clearNavDirection` says there isn't one.
 */
export function markNavDirection(direction: NavDirection): void {
  const root = document.documentElement;
  root.classList.remove(...DIRECTIONS);
  root.classList.add(direction);
}

/**
 * For a navigation that is not a move between the two screens — a Season
 * change, which stays on the Leaderboard and is narrated by `season-glitch.tsx`
 * instead. Without this the previous direction would still be on the root and
 * would slide a page that never left.
 */
export function clearNavDirection(): void {
  document.documentElement.classList.remove(...DIRECTIONS);
}
