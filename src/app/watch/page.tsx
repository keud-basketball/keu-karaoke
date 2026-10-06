import Link from "next/link";
import { KaraokePlayer } from "@/components/karaoke-player";
import { QueueSection } from "@/components/queue-section";
import { PerformanceRecorder } from "@/components/performance-recorder";
import { WatchSongActions } from "@/components/watch-song-actions";
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
          <p className="eyebrow">NOW SINGING</p>
          <h1>{title}</h1>
          {isValidVideoId ? (
            <>
              <KaraokePlayer videoId={videoId} />
              <WatchSongActions
                channelTitle={channelTitle}
                title={title}
                videoId={videoId}
              />
              <PerformanceRecorder songTitle={title} />
            </>
          ) : (
            <div className="state-card state-error" role="alert">
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
