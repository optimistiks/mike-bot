/**
 * Two letters for a Display identity's avatar.
 *
 * Handles arrive as `@first.second_third`, so the separators are the only
 * reliable word boundaries. A handle with no separator falls back to its first
 * two characters.
 */
export function displayInitials(displayName: string): string {
  const words = displayName
    .replace(/^@/, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

  if (words.length === 0) return "??";

  const letters =
    words.length > 1
      ? `${words[0].slice(0, 1)}${words[1].slice(0, 1)}`
      : words[0].slice(0, 2);

  return letters.toUpperCase();
}
