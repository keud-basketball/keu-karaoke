"use client";

import { useEffect, useState } from "react";
import type { KaraokeVideo } from "@/lib/search-types";

const STORAGE_KEY = "keu-karaoke-favorites";
const FAVORITES_UPDATED_EVENT = "keu-karaoke:favorites-updated";

export type FavoriteVideo = Pick<
  KaraokeVideo,
  "videoId" | "title" | "channelTitle" | "thumbnail"
>;

let memoryFavorites: FavoriteVideo[] | null = null;

function isFavoriteVideo(value: unknown): value is FavoriteVideo {
  return Boolean(
    value &&
      typeof value === "object" &&
      "videoId" in value &&
      typeof value.videoId === "string" &&
      /^[A-Za-z0-9_-]{11}$/.test(value.videoId) &&
      "title" in value &&
      typeof value.title === "string" &&
      value.title.trim() &&
      "channelTitle" in value &&
      typeof value.channelTitle === "string" &&
      value.channelTitle.trim() &&
      "thumbnail" in value &&
      typeof value.thumbnail === "string" &&
      value.thumbnail.startsWith("https://i.ytimg.com/"),
  );
}

export function getFavorites(): FavoriteVideo[] {
  if (typeof window === "undefined") return [];

  try {
    const stored: unknown = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? "[]",
    );
    if (!Array.isArray(stored)) {
      memoryFavorites = [];
      return [];
    }

    const favorites: FavoriteVideo[] = [];
    const seen = new Set<string>();
    for (const entry of stored) {
      if (!isFavoriteVideo(entry) || seen.has(entry.videoId)) continue;
      seen.add(entry.videoId);
      favorites.push({
        videoId: entry.videoId,
        title: entry.title,
        channelTitle: entry.channelTitle,
        thumbnail: entry.thumbnail,
      });
    }
    memoryFavorites = favorites;
    return favorites;
  } catch {
    return memoryFavorites ?? [];
  }
}

function storeFavorites(favorites: FavoriteVideo[]) {
  memoryFavorites = favorites;
  if (typeof window === "undefined") return;

  try {
    if (favorites.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    }
  } catch {
    // Keep favorites available for the current session when storage is blocked.
  }

  window.dispatchEvent(new Event(FAVORITES_UPDATED_EVENT));
}

export function toggleFavorite(video: KaraokeVideo) {
  const favorites = getFavorites();
  const existing = favorites.some((favorite) => favorite.videoId === video.videoId);
  storeFavorites(
    existing
      ? favorites.filter((favorite) => favorite.videoId !== video.videoId)
      : [
          ...favorites,
          {
            videoId: video.videoId,
            title: video.title,
            channelTitle: video.channelTitle,
            thumbnail: video.thumbnail,
          },
        ],
  );
}

export function removeFavorite(videoId: string) {
  storeFavorites(getFavorites().filter((favorite) => favorite.videoId !== videoId));
}

export function clearFavorites() {
  storeFavorites([]);
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteVideo[]>([]);

  useEffect(() => {
    const updateFavorites = () => setFavorites(getFavorites());
    updateFavorites();
    window.addEventListener(FAVORITES_UPDATED_EVENT, updateFavorites);
    window.addEventListener("storage", updateFavorites);
    return () => {
      window.removeEventListener(FAVORITES_UPDATED_EVENT, updateFavorites);
      window.removeEventListener("storage", updateFavorites);
    };
  }, []);

  return { favorites, toggle: toggleFavorite, remove: removeFavorite, clear: clearFavorites };
}
