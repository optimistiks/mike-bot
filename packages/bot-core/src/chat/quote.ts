const BRACKETS = /[[\]]/gu;

function stripBrackets(text: string): string {
  return text.replaceAll(BRACKETS, "");
}

function parentQuote(text: string): string | null {
  const cleaned = stripBrackets(text);
  if (cleaned === "") {
    return null;
  }
  return cleaned;
}

export { parentQuote, stripBrackets };
