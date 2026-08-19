import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Главная',
};

export default function HomePage() {
  return (
    <main>
      <h1>Mike-bot v2</h1>
      <p>Mini App scaffold — leaderboards arrive in ticket 23.</p>
    </main>
  );
}
