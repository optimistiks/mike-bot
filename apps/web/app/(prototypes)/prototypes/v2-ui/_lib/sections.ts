/**
 * The prototype's five sections, in the order they are swiped through.
 *
 * The titles deliberately diverge from the ones the scoring module ships, and
 * the order deliberately ends on the Karma-minus section so the Leaderboard
 * reads as one story ending on the burn. Production's titles are not touched;
 * this maps its section ids onto the prototype's names.
 */
export const PROTOTYPE_SECTIONS = [
  { id: "karma-received", title: "Уважаемые люди" },
  { id: "humor-received", title: "Юмористы" },
  { id: "karma-plus-given", title: "На позитиве" },
  { id: "humor-given", title: "Хотят смеяться 5 минут" },
  { id: "karma-minus-given", title: "Как же у них горит" },
] as const;

export type PrototypeSectionId = (typeof PROTOTYPE_SECTIONS)[number]["id"];
