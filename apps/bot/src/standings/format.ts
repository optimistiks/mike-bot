import type { StandingRow } from "./query";

const CROWN = "\u{1F451}";
const CHICKEN = "\u{1F414}";
const PLUS = "\u2795";
const MINUS = "\u2796";

interface RankedLine {
  name: string;
  score: number;
  flair: string;
}

export function formatStandings(rows: StandingRow[]): string {
  const n = rows.length;
  const karma = rank(rows, (row) => row.karmaReceived, true);
  const humor = rank(applyHumorDecay(rows, n), (row) => row.humorReceived, true);
  const plusGiven = rank(rows, (row) => row.karmaPlusGiven, false);
  const minusGiven = rank(rows, (row) => row.karmaMinusGiven, false);
  const humorGiven = rank(rows, (row) => row.humorGiven, false);

  return [
    section("*Уважаемые люди:*", karma, true),
    section("*Юмористы:*", humor, true),
    section(`*Поставили ${PLUS}:*`, plusGiven, false),
    section(`*Поставили ${MINUS}:*`, minusGiven, false),
    section("*Поставили лол:*", humorGiven, false),
  ].join("");
}

function applyHumorDecay(rows: StandingRow[], n: number): StandingRow[] {
  const ordered = [...rows].toSorted(compareScore((row) => row.humorReceived));
  return ordered.map((row, index) => {
    const loss = ((n - index - 1) * (40 / n)) / 100;
    return {
      ...row,
      humorReceived: row.humorReceived - Math.round(row.humorReceived * loss),
    };
  });
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
    let flair = "";
    if (withFlair) {
      if (score === highest) {
        flair = CROWN;
      }
      if (lowest < highest && score === lowest) {
        flair = CHICKEN;
      }
    }
    return { name: row.name, score, flair };
  });
}

function emptyRow(): StandingRow {
  return {
    memberId: 0,
    name: "???",
    karmaReceived: 0,
    humorReceived: 0,
    karmaPlusGiven: 0,
    karmaMinusGiven: 0,
    humorGiven: 0,
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

function section(title: string, lines: RankedLine[], padEmptyFlair: boolean): string {
  const body = lines
    .map((line) => {
      if (line.flair !== "") {
        return `${line.name}: ${String(line.score)} ${line.flair}`;
      }
      if (padEmptyFlair) {
        return `${line.name}: ${String(line.score)} `;
      }
      return `${line.name}: ${String(line.score)}`;
    })
    .join("\n");

  const blank = padEmptyFlair || title !== "*Поставили лол:*" ? "\n\n" : "\n";
  return `${title}\n${body}${blank}`;
}
