import type { StandingRow } from "./query.js";

const CROWN = "\u{1F451}";
const CHICKEN = "\u{1F414}";
const PLUS = "\u2795";
const MINUS = "\u2796";
const UNKNOWN_MEMBER = "???";
const TABLE_OPEN = "<table bordered striped compact>";

interface RankedLine {
  name: string;
  score: number;
  flair: string;
}

function emptyRow(): StandingRow {
  return {
    humorGiven: 0,
    humorReceived: 0,
    karmaMinusGiven: 0,
    karmaPlusGiven: 0,
    karmaReceived: 0,
    memberId: 0,
    name: UNKNOWN_MEMBER,
  };
}

function compareScore(
  scoreOf: (row: StandingRow) => number,
): (left: StandingRow, right: StandingRow) => number {
  return (left, right) => {
    const delta = scoreOf(right) - scoreOf(left);
    if (delta !== 0) {
      return delta;
    }
    return left.memberId - right.memberId;
  };
}

function isLowestDistinct(score: number, highest: number, lowest: number): boolean {
  return lowest < highest && score === lowest;
}

function pickFlair(score: number, highest: number, lowest: number): string {
  if (score === highest) {
    return CROWN;
  }
  if (isLowestDistinct(score, highest, lowest)) {
    return CHICKEN;
  }
  return "";
}

function flairFor(score: number, highest: number, lowest: number, withFlair: boolean): string {
  if (!withFlair) {
    return "";
  }
  return pickFlair(score, highest, lowest);
}

function rank(
  rows: StandingRow[],
  scoreOf: (row: StandingRow) => number,
  withFlair: boolean,
): RankedLine[] {
  const ordered = [...rows].toSorted(compareScore(scoreOf));
  const highest = scoreOf(ordered[0] ?? emptyRow());
  const lowest = scoreOf(ordered.at(-1) ?? emptyRow());

  return ordered.map((row) => {
    const score = scoreOf(row);
    return { flair: flairFor(score, highest, lowest, withFlair), name: row.name, score };
  });
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function isCrown(line: RankedLine): boolean {
  return line.flair === CROWN;
}

function wrapCrown(line: RankedLine, inner: string): string {
  if (!isCrown(line)) {
    return inner;
  }
  return `<b>${inner}</b>`;
}

function displayName(line: RankedLine): string {
  const name = escapeHtml(line.name);
  if (line.flair === "") {
    return name;
  }
  return `${name} ${line.flair}`;
}

function formatRow(line: RankedLine): string {
  const name = wrapCrown(line, displayName(line));
  const score = wrapCrown(line, String(line.score));
  return `<tr><td>${name}</td><td align="center">${score}</td></tr>`;
}

function formatTable(lines: RankedLine[]): string {
  return `${TABLE_OPEN}${lines.map((line) => formatRow(line)).join("")}</table>`;
}

function section(title: string, lines: RankedLine[]): string {
  return `<h2>${title}</h2>${formatTable(lines)}`;
}

function formatStandings(rows: StandingRow[], year: number): string {
  const karma = rank(rows, (row) => row.karmaReceived, true);
  const humor = rank(rows, (row) => row.humorReceived, true);
  const plusGiven = rank(rows, (row) => row.karmaPlusGiven, false);
  const minusGiven = rank(rows, (row) => row.karmaMinusGiven, false);
  const humorGiven = rank(rows, (row) => row.humorGiven, false);

  return `<h1>Сезон ${String(year)}</h1>${[
    section("Уважаемые люди", karma),
    section("Юмористы", humor),
    section(`Поставили ${PLUS}`, plusGiven),
    section(`Поставили ${MINUS}`, minusGiven),
    section("Поставили лол", humorGiven),
  ].join("<hr/>")}`;
}

export { formatStandings };
