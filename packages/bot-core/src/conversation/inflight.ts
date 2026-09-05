const inflight = new Set<string>();

function participantKey(conversationId: string, memberId: number): string {
  return `${conversationId}:${String(memberId)}`;
}

function tryBeginCompletion(conversationId: string, memberId: number): boolean {
  const key = participantKey(conversationId, memberId);
  if (inflight.has(key)) {
    return false;
  }
  inflight.add(key);
  return true;
}

function endCompletion(conversationId: string, memberId: number): void {
  inflight.delete(participantKey(conversationId, memberId));
}

export { endCompletion, tryBeginCompletion };
