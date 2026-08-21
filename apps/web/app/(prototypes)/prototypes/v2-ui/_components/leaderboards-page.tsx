/**
 * Placeholder shell. Ticket 02 replaces this with fixture-backed, Chat-scoped
 * sections; tickets 03-05 give them their real shape.
 */
export function LeaderboardsPage({ title }: { title: string }) {
  return (
    <div className="arcade-screen gap-6 overflow-y-auto px-4 py-8">
      <h1 className="arcade-text-lg text-primary">{title}</h1>
    </div>
  );
}
