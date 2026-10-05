import Link from "next/link";
import { FavoritesSection } from "@/components/favorites-section";

export default function FavoritesPage() {
  return (
    <main className="app-shell page-shell">
      <div className="page-content">
        <header className="page-header">
          <Link className="wordmark" href="/">KEURAOKE</Link>
          <p>Your saved karaoke songs</p>
        </header>
        <FavoritesSection />
        <footer className="page-footer">Your song. Your moment.</footer>
      </div>
    </main>
  );
}
