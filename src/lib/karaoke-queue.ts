"use client";

import { useEffect, useState } from "react";
import type { KaraokeVideo } from "@/lib/search-types";

const STORAGE_KEY = "keu-karaoke-queue";
const QUEUE_UPDATED_EVENT = "keu-karaoke:queue-updated";

export type QueuedVideo = Pick<
  KaraokeVideo,
  "videoId" | "title" | "channelTitle" | "thumbnail"
>;

let memoryQueue: QueuedVideo[] | null = null;

function isQueuedVideo(value: unknown): value is QueuedVideo {
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

export function getQueue(): QueuedVideo[] {
  if (typeof window === "undefined") return [];

  try {
    const stored: unknown = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? "[]",
    );
    if (!Array.isArray(stored)) {
      memoryQueue = [];
      return [];
    }

    const queue: QueuedVideo[] = [];
    const seen = new Set<string>();
    for (const entry of stored) {
      if (!isQueuedVideo(entry) || seen.has(entry.videoId)) continue;
      seen.add(entry.videoId);
      queue.push({
        videoId: entry.videoId,
        title: entry.title,
        channelTitle: entry.channelTitle,
        thumbnail: entry.thumbnail,
      });
    }
    memoryQueue = queue;
    return queue;
  } catch {
    return memoryQueue ?? [];
  }
}

function storeQueue(queue: QueuedVideo[]) {
  memoryQueue = queue;
  if (typeof window === "undefined") return;

  try {
    if (queue.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    }
  } catch {
    // Keep the queue available for the current session if storage is blocked.
  }

  window.dispatchEvent(new Event(QUEUE_UPDATED_EVENT));
}

export function addToQueue(video: KaraokeVideo): boolean {
  const queue = getQueue();
  if (queue.some((item) => item.videoId === video.videoId)) return false;

  storeQueue([
    ...queue,
    {
      videoId: video.videoId,
      title: video.title,
      channelTitle: video.channelTitle,
      thumbnail: video.thumbnail,
    },
  ]);
  return true;
}

export function removeFromQueue(videoId: string) {
  storeQueue(getQueue().filter((item) => item.videoId !== videoId));
}

export function clearQueue() {
  storeQueue([]);
}

export function useKaraokeQueue() {
  const [queue, setQueue] = useState<QueuedVideo[]>([]);

  useEffect(() => {
    const updateQueue = () => setQueue(getQueue());
    updateQueue();
    window.addEventListener(QUEUE_UPDATED_EVENT, updateQueue);
    window.addEventListener("storage", updateQueue);
    return () => {
      window.removeEventListener(QUEUE_UPDATED_EVENT, updateQueue);
      window.removeEventListener("storage", updateQueue);
    };
  }, []);

  return { queue, add: addToQueue, remove: removeFromQueue, clear: clearQueue };
}
