import Link from "next/link";
import { RecentSearches } from "@/components/recent-searches";

export default function HistoryPage() {
  return (
    <main className="app-shell page-shell">
      <div className="page-content">
        <header className="page-header">
          <Link className="wordmark" href="/">KEURAOKE</Link>
          <p>Find a song you searched for before</p>
        </header>
        <RecentSearches />
        <footer className="page-footer">Your song. Your moment.</footer>
      </div>
    </main>
  );
}
