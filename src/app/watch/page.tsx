import Link from "next/link";
import { KaraokePlayback } from "@/components/karaoke-playback";
import { QueueSection } from "@/components/queue-section";
import { decodeHtmlEntities } from "@/lib/decode-html-entities";

type WatchPageProps = {
  searchParams: Promise<{
    id?: string | string[];
    title?: string | string[];
    channel?: string | string[];
    q?: string | string[];
  }>;
};

function oneParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

export default async function WatchPage({ searchParams }: WatchPageProps) {
  const params = await searchParams;
  const videoId = oneParam(params.id);
  const title = decodeHtmlEntities(oneParam(params.title)) || "Karaoke video";
  const channelTitle = decodeHtmlEntities(oneParam(params.channel)) || "Karaoke video";
  const query = oneParam(params.q);
  const backHref = query ? `/?q=${encodeURIComponent(query)}` : "/";
  const isValidVideoId = /^[A-Za-z0-9_-]{11}$/.test(videoId);

  return (
    <main className="app-shell page-shell">
      <div className="page-content player-content">
        <header className="page-header">
          <Link className="wordmark" href="/">KEURAOKE</Link>
          <p>Your song. Your moment.</p>
        </header>

        <section className="player-section">
          {isValidVideoId ? (
            <KaraokePlayback
              query={query}
              video={{
                videoId,
                title,
                channelTitle,
                thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
              }}
            />
          ) : (
            <div className="state-card state-error" role="alert">
              <p className="eyebrow">NOW SINGING</p>
              <h1>{title}</h1>
              <p>This karaoke video link is invalid. Choose a result to start singing.</p>
            </div>
          )}
          <nav className="player-actions" aria-label="Player navigation">
            <Link className="button button-secondary" href={backHref}>
              ← BACK TO RESULTS
            </Link>
            <Link className="button button-text" href="/">
              SEARCH ANOTHER SONG
            </Link>
          </nav>
        </section>
        <QueueSection />
        <footer className="page-footer">Powered by the official YouTube player</footer>
      </div>
    </main>
  );
}
