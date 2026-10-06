"use client";

import { useFavorites } from "@/lib/favorites";
import { useKaraokeQueue } from "@/lib/karaoke-queue";
import type { KaraokeVideo } from "@/lib/search-types";

type WatchSongActionsProps = {
  videoId: string;
  title: string;
  channelTitle: string;
};

export function WatchSongActions({
  videoId,
  title,
  channelTitle,
}: WatchSongActionsProps) {
  const { favorites, toggle: toggleFavorite } = useFavorites();
  const { queue, add: addToQueue } = useKaraokeQueue();
  const video: KaraokeVideo = {
    videoId,
    title,
    channelTitle,
    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  };
  const isFavorite = favorites.some((favorite) => favorite.videoId === videoId);
  const isQueued = queue.some((item) => item.videoId === videoId);

  return (
    <div className="watch-song-actions">
      <button
        aria-pressed={isFavorite}
        className={`button button-favorite${isFavorite ? " is-favorite" : ""}`}
        onClick={() => toggleFavorite(video)}
        type="button"
      >
        <span aria-hidden="true">{isFavorite ? "♥" : "♡"}</span>
        {isFavorite ? "FAVORITED" : "FAVORITE"}
      </button>
      <button
        aria-pressed={isQueued}
        className={`button button-queue${isQueued ? " is-queued" : ""}`}
        disabled={isQueued}
        onClick={() => addToQueue(video)}
        type="button"
      >
        {isQueued ? "IN QUEUE" : "🎤 QUEUE"}
      </button>
    </div>
  );
}
