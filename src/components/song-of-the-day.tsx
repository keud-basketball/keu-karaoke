"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { KaraokeVideo } from "@/lib/search-types";
import { decodeHtmlEntities } from "@/lib/decode-html-entities";

const dailySongs = [
  { title: "I Will Always Love You", artist: "Whitney Houston" },
  { title: "My Way", artist: "Frank Sinatra" },
  { title: "Total Eclipse of the Heart", artist: "Bonnie Tyler" },
  { title: "Through the Years", artist: "Kenny Rogers" },
  { title: "Hard to Say I'm Sorry", artist: "Chicago" },
  { title: "Can't Help Falling in Love", artist: "Elvis Presley" },
];

type SearchResponse = {
  videos: KaraokeVideo[];
};

function isKaraokeVideo(value: unknown): value is KaraokeVideo {
  return Boolean(
    value &&
      typeof value === "object" &&
      "videoId" in value &&
      typeof value.videoId === "string" &&
      /^[A-Za-z0-9_-]{11}$/.test(value.videoId) &&
      "title" in value &&
      typeof value.title === "string" &&
      "channelTitle" in value &&
      typeof value.channelTitle === "string" &&
      "thumbnail" in value &&
      typeof value.thumbnail === "string",
  );
}

function isSearchResponse(value: unknown): value is SearchResponse {
  return Boolean(
    value &&
      typeof value === "object" &&
      "videos" in value &&
      Array.isArray(value.videos) &&
      value.videos.every(isKaraokeVideo),
  );
}

function errorMessage(value: unknown) {
  return value &&
    typeof value === "object" &&
    "error" in value &&
    value.error &&
    typeof value.error === "object" &&
    "message" in value.error &&
    typeof value.error.message === "string"
    ? value.error.message
    : "Today’s karaoke song couldn’t be loaded. Please try again.";
}

function songForDate(date: Date) {
  const day = Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  );
  return dailySongs[day % dailySongs.length];
}

export function SongOfTheDay() {
  const router = useRouter();
  const [song, setSong] = useState<(typeof dailySongs)[number] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => setSong(songForDate(new Date())), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  async function singNow() {
    if (!song || loading) return;
    setLoading(true);
    setError("");
    const query = `${song.title} ${song.artist}`;

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data: unknown = await response.json();
      if (!response.ok) {
        setError(errorMessage(data));
        return;
      }
      if (!isSearchResponse(data)) {
        setError("Today’s karaoke song returned an unexpected result. Please try again.");
        return;
      }
      const video = data.videos[0];
      if (!video) {
        setError("No karaoke result is available for today’s song. Please try again later.");
        return;
      }

      router.push(
        `/watch?id=${encodeURIComponent(video.videoId)}&title=${encodeURIComponent(decodeHtmlEntities(video.title))}&channel=${encodeURIComponent(decodeHtmlEntities(video.channelTitle))}&q=${encodeURIComponent(query)}`,
      );
    } catch {
      setError("Couldn’t connect to karaoke search. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="song-of-day" aria-labelledby="song-of-day-heading">
      <p className="eyebrow" id="song-of-day-heading">⭐ SONG OF THE DAY</p>
      <h2>{song?.title ?? "Finding today’s song..."}</h2>
      {song && <p className="song-of-day-artist">{song.artist}</p>}
      <button
        className="button button-primary song-of-day-button"
        disabled={!song || loading}
        onClick={singNow}
        type="button"
      >
        {loading ? "FINDING KARAOKE..." : song ? "🎤 SING NOW" : "LOADING SONG..."}
      </button>
      {error && <p className="song-of-day-error" role="alert">{error}</p>}
    </section>
  );
}
