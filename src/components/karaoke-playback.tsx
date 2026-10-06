"use client";

import { useRef, useState } from "react";
import { KaraokePlayer } from "@/components/karaoke-player";
import { PerformanceRecorder } from "@/components/performance-recorder";
import { WatchSongActions } from "@/components/watch-song-actions";
import type { KaraokeVideo } from "@/lib/search-types";

type KaraokePlaybackProps = {
  video: KaraokeVideo;
  query: string;
};

type SearchResponse = {
  videos: KaraokeVideo[];
  nextPageToken?: string;
};

function isSearchResponse(value: unknown): value is SearchResponse {
  return Boolean(
    value &&
      typeof value === "object" &&
      "videos" in value &&
      Array.isArray(value.videos) &&
      value.videos.every(
        (video) =>
          video &&
          typeof video === "object" &&
          "videoId" in video &&
          typeof video.videoId === "string" &&
          "title" in video &&
          typeof video.title === "string" &&
          "channelTitle" in video &&
          typeof video.channelTitle === "string" &&
          "thumbnail" in video &&
          typeof video.thumbnail === "string",
      ) &&
      (!("nextPageToken" in value) ||
        typeof value.nextPageToken === "string"),
  );
}

export function KaraokePlayback({ video, query }: KaraokePlaybackProps) {
  const [currentVideo, setCurrentVideo] = useState(video);
  const [unavailableVideoId, setUnavailableVideoId] = useState<string | null>(
    null,
  );
  const failedVideoIds = useRef(new Set<string>());

  async function tryNextVideo(failedVideoId: string) {
    if (failedVideoIds.current.has(failedVideoId)) return;
    failedVideoIds.current.add(failedVideoId);

    const fallbackQuery = query || `${video.title} ${video.channelTitle}`;
    let pageToken: string | undefined;

    try {
      for (let page = 0; page < 3; page += 1) {
        const params = new URLSearchParams({ q: fallbackQuery });
        if (pageToken) params.set("pageToken", pageToken);

        const response = await fetch(`/api/search?${params.toString()}`);
        if (!response.ok) break;
        const data: unknown = await response.json();
        if (!isSearchResponse(data)) break;

        const nextVideo = data.videos.find(
          (candidate) => !failedVideoIds.current.has(candidate.videoId),
        );
        if (nextVideo) {
          setCurrentVideo(nextVideo);
          setUnavailableVideoId(null);
          return;
        }

        pageToken = data.nextPageToken;
        if (!pageToken) break;
      }
    } catch {
      // The existing unavailable message is shown when a fallback cannot be loaded.
    }

    setUnavailableVideoId(failedVideoId);
  }

  return (
    <>
      <p className="eyebrow">NOW SINGING</p>
      <h1>{currentVideo.title}</h1>
      <KaraokePlayer
        videoId={currentVideo.videoId}
        onError={tryNextVideo}
        unavailable={unavailableVideoId === currentVideo.videoId}
      />
      <WatchSongActions
        channelTitle={currentVideo.channelTitle}
        title={currentVideo.title}
        videoId={currentVideo.videoId}
      />
      <PerformanceRecorder songTitle={currentVideo.title} />
    </>
  );
}
