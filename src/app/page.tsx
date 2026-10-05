import Link from "next/link";
import { SearchForm } from "@/components/search-form";
import { SearchResults } from "@/components/search-results";
import { SongOfTheDay } from "@/components/song-of-the-day";

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
    <main className="app-shell">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <section className="home-content">
        <div className="brand-mark" aria-hidden="true">
          <span className="brand-mark-note">♪</span>
        </div>
        <p className="eyebrow">YOUR NEXT SONG STARTS HERE</p>
        <h1>KEURAOKE</h1>
        <p className="home-subtitle">Search a song and start singing</p>
        <SongOfTheDay />
        <SearchForm compact initialQuery={query} key={query} />
        <SearchResults query={query} />

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
