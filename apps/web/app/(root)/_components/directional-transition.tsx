import { ViewTransition } from "react";

/**
 * The whole of one route, named so the browser can animate it leaving or
 * arriving.
 *
 * The name is spelled out rather than left to React because React's generated
 * names (`_t_0_`, `_t_1_`) are positional: they say which boundary this is, not
 * which page. `arcade.css` has to know which page is leaving to know which way
 * it slides, and it can only know that from a stable name.
 *
 * Direction itself is not a prop here at all — it rides on `<html>`, set by
 * `markNavDirection` in `../_lib/nav-direction`. See that file for why a root
 * class rather than a React transition type.
 */
export function DirectionalTransition({
  name,
  children,
}: {
  /** Matched verbatim by the `::view-transition-*(page-…)` rules in `arcade.css`. */
  name: "page-chats" | "page-leaderboard" | "page-settings";
  children: React.ReactNode;
}) {
  return <ViewTransition name={name}>{children}</ViewTransition>;
}
