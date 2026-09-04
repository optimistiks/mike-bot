import { EMPTY_COUNT, FIRST_INDEX, LAST_FROM_END, SINGLE_COUNT } from "#src/bot/constants.js";

import type { StandingRow } from "./query.js";

const CROWN = "\u{1F451}";
const CHICKEN = "\u{1F414}";
const PLUS = "\u2795";
const MINUS = "\u2796";
const HUMOR_DECAY_RATE = 40;
const PERCENT = 100;
const UNKNOWN_MEMBER = "???";

interface RankedLine {
  name: string;
  score: number;
  flair: string;
}

function emptyRow(): StandingRow {
  return {
    humorGiven: EMPTY_COUNT,
    humorReceived: EMPTY_COUNT,
    karmaMinusGiven: EMPTY_COUNT,
    karmaPlusGiven: EMPTY_COUNT,
    karmaReceived: EMPTY_COUNT,
    memberId: EMPTY_COUNT,
    name: UNKNOWN_MEMBER,
  };
}

function compareScore(
  scoreOf: (row: StandingRow) => number,
): (left: StandingRow, right: StandingRow) => number {
  return (left, right) => {
    const delta = scoreOf(right) - scoreOf(left);
    if (delta !== EMPTY_COUNT) {
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
  const highest = scoreOf(ordered[FIRST_INDEX] ?? emptyRow());
  const lowest = scoreOf(ordered.at(LAST_FROM_END) ?? emptyRow());

  return ordered.map((row) => {
    const score = scoreOf(row);
    return { flair: flairFor(score, highest, lowest, withFlair), name: row.name, score };
  });
}

function humorAfterDecay(row: StandingRow, index: number, memberCount: number): number {
  const loss = ((memberCount - index - SINGLE_COUNT) * (HUMOR_DECAY_RATE / memberCount)) / PERCENT;
  return row.humorReceived - Math.round(row.humorReceived * loss);
}

function withHumorReceived(row: StandingRow, humorReceived: number): StandingRow {
  return {
    humorGiven: row.humorGiven,
    humorReceived,
    karmaMinusGiven: row.karmaMinusGiven,
    karmaPlusGiven: row.karmaPlusGiven,
    karmaReceived: row.karmaReceived,
    memberId: row.memberId,
    name: row.name,
  };
}

function applyHumorDecay(rows: StandingRow[], memberCount: number): StandingRow[] {
  const ordered = [...rows].toSorted(compareScore((row) => row.humorReceived));
  return ordered.map((row, index) =>
    withHumorReceived(row, humorAfterDecay(row, index, memberCount)),
  );
}

function formatLine(line: RankedLine, padEmptyFlair: boolean): string {
  if (line.flair !== "") {
    return `${line.name}: ${String(line.score)} ${line.flair}`;
  }
  if (padEmptyFlair) {
    return `${line.name}: ${String(line.score)} `;
  }
  return `${line.name}: ${String(line.score)}`;
}

function section(title: string, lines: RankedLine[], padEmptyFlair: boolean): string {
  const body = lines.map((line) => formatLine(line, padEmptyFlair)).join("\n");
  const blank = padEmptyFlair || title !== "*Поставили лол:*" ? "\n\n" : "\n";
  return `${title}\n${body}${blank}`;
}

function formatStandings(rows: StandingRow[]): string {
  const memberCount = rows.length;
  const karma = rank(rows, (row) => row.karmaReceived, true);
  const humor = rank(applyHumorDecay(rows, memberCount), (row) => row.humorReceived, true);
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

export { formatStandings };
