import Link from "next/link";
import Image from "next/image";
import { SearchForm } from "@/components/search-form";
import { SearchResults } from "@/components/search-results";
import { SongOfTheDay } from "@/components/song-of-the-day";

const featuredVideos = [
  { id: "tbTslGUwQMQ", title: "Featured song 1" },
  { id: "od6l59ZCMCg", title: "Featured song 2" },
  { id: "Rkg3bK32cKQ", title: "Featured song 3" },
  { id: "LL0eqNibz1E", title: "Featured song 4" },
];

type HomePageProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

const popularSearches = [
  "214",
  "My Way",
  "Through the Years",
  "I Will Always Love You",
  "Total Eclipse of the Heart",
];

export default async function Home({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";

  return (
    <main className="app-shell home-shell">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <section className="home-content">
        <header className="home-header">
          <div className="brand-mark" aria-hidden="true">
            <span className="brand-mark-note">♪</span>
          </div>
          <p className="eyebrow">YOUR NEXT SONG STARTS HERE</p>
          <h1>KEURAOKE</h1>
          <p className="home-subtitle">Search a song and start singing</p>
          <SearchForm compact initialQuery={query} key={query} />
        </header>
        <SongOfTheDay />
        <section className="featured-youtube" aria-labelledby="featured-youtube-heading">
          <h2 id="featured-youtube-heading">🎵 FEATURED ON YOUTUBE</h2>
          <div className="featured-youtube-grid">
            {featuredVideos.map((video) => (
              <Link
                aria-label={`Open ${video.title} on YouTube`}
                className="featured-youtube-card"
                href={`/watch?id=${video.id}&title=${encodeURIComponent(video.title)}&channel=Featured%20YouTube&autoplay=0`}
                key={video.id}
                prefetch={false}
              >
                <span className="featured-youtube-thumbnail">
                  <Image
                    alt=""
                    height={360}
                    loading="lazy"
                    src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`}
                    unoptimized
                    width={480}
                  />
                  <span className="featured-youtube-play" aria-hidden="true">▶</span>
                </span>
                <span className="featured-youtube-info">
                  <strong>{video.title}</strong>
                  <span className="featured-youtube-brand">▶ YouTube</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
        <div className="home-results-scroll">
          <SearchResults query={query} />
        </div>

        <section className="popular-section" aria-labelledby="popular-heading">
          <h2 id="popular-heading">Popular Karaoke Searches</h2>
          <div className="suggestions">
            {popularSearches.map((song) => (
              <Link
                className="suggestion-chip"
                href={`/?q=${encodeURIComponent(song)}`}
                key={song}
              >
                {song}
              </Link>
            ))}
          </div>
        </section>
        <p className="home-note">Find a track. Take the mic. Make it yours.</p>
      </section>
    </main>
  );
}
