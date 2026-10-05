import Link from "next/link";
import { QueueSection } from "@/components/queue-section";

export default function QueuePage() {
  return (
    <main className="app-shell page-shell">
      <div className="page-content">
        <header className="page-header">
          <Link className="wordmark" href="/">KEURAOKE</Link>
          <p>Your Up Next karaoke queue</p>
        </header>
        <QueueSection showEmpty />
        <footer className="page-footer">Your song. Your moment.</footer>
      </div>
    </main>
  );
}
