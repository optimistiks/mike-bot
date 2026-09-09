const QUOTE_MAX_CHARS = 200;
const QUOTE_ELLIPSIS = "...";
const QUOTE_FORBIDDEN = /["[\]]/gu;
const WHITESPACE = /\s+/gu;

function collapseWhitespace(text: string): string {
  return text.trim().replaceAll(WHITESPACE, " ");
}

function stripForbidden(text: string): string {
  return text.replaceAll(QUOTE_FORBIDDEN, "");
}

function truncateQuote(text: string): string {
  if (text.length <= QUOTE_MAX_CHARS) {
    return text;
  }
  return `${text.slice(0, QUOTE_MAX_CHARS)}${QUOTE_ELLIPSIS}`;
}

function sanitizedQuote(text: string): string | null {
  const cleaned = stripForbidden(collapseWhitespace(text));
  if (cleaned === "") {
    return null;
  }
  return truncateQuote(cleaned);
}

export { sanitizedQuote };
