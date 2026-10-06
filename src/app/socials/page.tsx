import Link from "next/link";
import { SocialsFeed } from "@/components/socials/socials-feed";

export default function SocialsPage() {
  return (
    <main className="app-shell page-shell">
      <div className="page-content">
        <header className="page-header">
          <Link className="wordmark" href="/">KEURAOKE</Link>
          <p>Your performances, shared inside KEURAOKE</p>
        </header>
        <SocialsFeed />
        <footer className="page-footer">Sing it. Share it. Keep it yours.</footer>
      </div>
    </main>
  );
}
