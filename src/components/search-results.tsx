"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { KaraokeVideo } from "@/lib/search-types";
import { SEARCH_AGAIN_EVENT } from "@/lib/search-types";
import { saveRecentSearch } from "@/lib/search-history";
import { useFavorites } from "@/lib/favorites";
import { useKaraokeQueue } from "@/lib/karaoke-queue";
import { decodeHtmlEntities } from "@/lib/decode-html-entities";

type SearchResultsProps = {
  query: string;
};

type SearchResponse = {
  videos: KaraokeVideo[];
  nextPageToken?: string;
};

type SearchState = {
  query: string;
  status: "success" | "error";
  videos: KaraokeVideo[];
  error: string;
  nextPageToken?: string;
};

function isKaraokeVideo(value: unknown): value is KaraokeVideo {
  return Boolean(
    value &&
      typeof value === "object" &&
      "videoId" in value &&
      typeof value.videoId === "string" &&
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
      value.videos.every(isKaraokeVideo) &&
      (!("nextPageToken" in value) ||
        typeof value.nextPageToken === "string"),
  );
}

function responseErrorMessage(data: unknown) {
  return data &&
    typeof data === "object" &&
    "error" in data &&
    data.error &&
    typeof data.error === "object" &&
    "message" in data.error &&
    typeof data.error.message === "string"
    ? data.error.message
    : "Karaoke search is temporarily unavailable. Please try again.";
}

export function SearchResults({ query }: SearchResultsProps) {
  const { favorites, toggle: toggleFavorite } = useFavorites();
  const { queue, add: addToQueue } = useKaraokeQueue();
  const [searchState, setSearchState] = useState<SearchState | null>(null);
  const [searchRevision, setSearchRevision] = useState(0);
  const [loadingMoreState, setLoadingMoreState] = useState<{
    query: string;
    requestId: number;
  } | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<{
    query: string;
    message: string;
  } | null>(null);
  const searchGeneration = useRef(0);
  const nextLoadMoreId = useRef(0);
  const loadingMoreRequest = useRef<{
    query: string;
    requestId: number;
  } | null>(null);
  const normalizedQuery = query.trim();
  const searchIsCurrent = searchState?.query === normalizedQuery;
  const loading = Boolean(normalizedQuery) && !searchIsCurrent;
  const error = searchIsCurrent && searchState.status === "error" ? searchState.error : "";
  const videos =
    searchIsCurrent && searchState.status === "success" ? searchState.videos : [];
  const nextPageToken =
    searchIsCurrent && searchState.status === "success"
      ? searchState.nextPageToken
      : undefined;
  const loadingMore = loadingMoreState?.query === normalizedQuery;
  const currentLoadMoreError =
    loadMoreError?.query === normalizedQuery ? loadMoreError.message : "";
  const favoriteIds = new Set(favorites.map((favorite) => favorite.videoId));
  const queuedIds = new Set(queue.map((video) => video.videoId));

  useEffect(() => {
    function repeatSearch() {
      searchGeneration.current += 1;
      setSearchState(null);
      setLoadMoreError(null);
      loadingMoreRequest.current = null;
      setLoadingMoreState(null);
      setSearchRevision((revision) => revision + 1);
    }

    window.addEventListener(SEARCH_AGAIN_EVENT, repeatSearch);
    return () => window.removeEventListener(SEARCH_AGAIN_EVENT, repeatSearch);
  }, []);

  useEffect(() => {
    if (!normalizedQuery) {
      return;
    }

    const generation = ++searchGeneration.current;
    const controller = new AbortController();

    async function search() {
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(normalizedQuery)}`,
          { signal: controller.signal },
        );
        const data: unknown = await response.json();
        if (
          controller.signal.aborted ||
          generation !== searchGeneration.current
        ) {
          return;
        }
        if (!response.ok) {
          const message = responseErrorMessage(data);
          setSearchState({
            query: normalizedQuery,
            status: "error",
            videos: [],
            error: message,
          });
          return;
        }

        if (!isSearchResponse(data)) {
          setSearchState({
            query: normalizedQuery,
            status: "error",
            videos: [],
            error: "We couldn’t read the search results. Please try again.",
          });
          return;
        }

        setSearchState({
          query: normalizedQuery,
          status: "success",
          videos: data.videos,
          error: "",
          ...(data.nextPageToken ? { nextPageToken: data.nextPageToken } : {}),
        });
        saveRecentSearch(normalizedQuery);
      } catch {
        if (
          !controller.signal.aborted &&
          generation === searchGeneration.current
        ) {
          setSearchState({
            query: normalizedQuery,
            status: "error",
            videos: [],
            error: "Couldn’t connect to karaoke search. Check your connection and try again.",
          });
        }
      }
    }

    void search();
    return () => controller.abort();
  }, [normalizedQuery, searchRevision]);

  async function loadMore() {
    if (
      !searchState ||
      searchState.query !== normalizedQuery ||
      searchState.status !== "success" ||
      !searchState.nextPageToken ||
      loadingMoreRequest.current?.query === normalizedQuery
    ) {
      return;
    }

    const requestId = ++nextLoadMoreId.current;
    const generation = searchGeneration.current;
    const request = { query: normalizedQuery, requestId };
    loadingMoreRequest.current = request;
    setLoadingMoreState({ query: normalizedQuery, requestId });
    setLoadMoreError(null);

    try {
      const params = new URLSearchParams({
        q: normalizedQuery,
        pageToken: searchState.nextPageToken,
      });
      const response = await fetch(`/api/search?${params.toString()}`);
      const data: unknown = await response.json();

      if (generation !== searchGeneration.current) return;

      if (!response.ok) {
        setLoadMoreError({
          query: normalizedQuery,
          message: responseErrorMessage(data),
        });
        return;
      }

      if (!isSearchResponse(data)) {
        setLoadMoreError({
          query: normalizedQuery,
          message: "We couldn’t read the additional results. Please try again.",
        });
        return;
      }

      setSearchState((current) => {
        if (
          current?.query !== normalizedQuery ||
          current.status !== "success"
        ) {
          return current;
        }
        const existingIds = new Set(current.videos.map((video) => video.videoId));
        const newVideos = data.videos.filter((video) => {
          if (existingIds.has(video.videoId)) return false;
          existingIds.add(video.videoId);
          return true;
        });
        return {
          ...current,
          videos: [...current.videos, ...newVideos],
          ...(data.nextPageToken
            ? { nextPageToken: data.nextPageToken }
            : { nextPageToken: undefined }),
        };
      });
    } catch {
      if (generation === searchGeneration.current) {
        setLoadMoreError({
          query: normalizedQuery,
          message: "Couldn’t load more karaoke results. Check your connection and try again.",
        });
      }
    } finally {
      if (loadingMoreRequest.current === request) {
        loadingMoreRequest.current = null;
        setLoadingMoreState((current) =>
          current?.requestId === requestId ? null : current,
        );
      }
    }
  }

  if (!query.trim()) {
    return (
      <section className="results-message">
        <h1>Karaoke Results</h1>
        <p>Enter a song title or artist to find karaoke tracks.</p>
      </section>
    );
  }

  return (
    <section className="results-section" aria-live="polite">
      <div className="results-heading">
        <div>
          <p className="eyebrow">SING SOMETHING YOU LOVE</p>
          <h1>Karaoke Results</h1>
        </div>
        {!loading && !error && (
          <span className="result-count">{videos.length} {videos.length === 1 ? "track" : "tracks"}</span>
        )}
      </div>

      {loading && (
        <div className="state-card" role="status">
          <span className="loader" aria-hidden="true" />
          <p>Searching karaoke songs...</p>
        </div>
      )}

      {!loading && error && (
        <div className="state-card state-error" role="alert">
          <span className="state-icon" aria-hidden="true">!</span>
          <h2>Search couldn’t be completed</h2>
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && videos.length === 0 && (
        <div className="state-card">
          <span className="state-icon" aria-hidden="true">♪</span>
          <h2>No karaoke results found.</h2>
          <p>Try another song title or artist.</p>
        </div>
      )}

      {!loading && !error && videos.length > 0 && (
        <div className="video-list">
          {videos.map((video) => {
            const title = decodeHtmlEntities(video.title);
            const channelTitle = decodeHtmlEntities(video.channelTitle);
            return (
            <article className="video-card" key={video.videoId}>
              <Image
                alt=""
                className="video-thumbnail"
                height={180}
                src={video.thumbnail}
                unoptimized
                width={320}
              />
              <div className="video-info">
                <h2>{title}</h2>
                <p>{channelTitle}</p>
                <div className="video-actions">
                  <Link
                    className="button button-play"
                    href={`/watch?id=${encodeURIComponent(video.videoId)}&title=${encodeURIComponent(title)}&q=${encodeURIComponent(query)}`}
                    aria-label={`Play karaoke video: ${title}`}
                  >
                    <span aria-hidden="true">▶</span> PLAY KARAOKE
                  </Link>
                  <button
                    aria-label={favoriteIds.has(video.videoId) ? `Remove ${title} from favorites` : `Save ${title} to favorites`}
                    aria-pressed={favoriteIds.has(video.videoId)}
                    className={`button button-favorite${favoriteIds.has(video.videoId) ? " is-favorite" : ""}`}
                    onClick={() => toggleFavorite(video)}
                    type="button"
                  >
                    <span aria-hidden="true">{favoriteIds.has(video.videoId) ? "♥" : "♡"}</span>
                    {!favoriteIds.has(video.videoId) && " Save"}
                  </button>
                  <button
                    aria-label={queuedIds.has(video.videoId) ? `${title} is in the queue` : `Add ${title} to the queue`}
                    aria-pressed={queuedIds.has(video.videoId)}
                    className={`button button-queue${queuedIds.has(video.videoId) ? " is-queued" : ""}`}
                    disabled={queuedIds.has(video.videoId)}
                    onClick={() => addToQueue(video)}
                    type="button"
                  >
                    {queuedIds.has(video.videoId) ? "IN QUEUE" : "+ ADD TO QUEUE"}
                  </button>
                </div>
              </div>
            </article>
            );
          })}
        </div>
      )}

      {!loading && !error && nextPageToken && (
        <div className="load-more-section">
          <button
            className="button button-primary load-more-button"
            disabled={loadingMore}
            onClick={loadMore}
            type="button"
          >
            {loadingMore ? "Loading more karaoke..." : "LOAD MORE"}
          </button>
          {currentLoadMoreError && (
            <p className="load-more-error" role="alert">{currentLoadMoreError}</p>
          )}
        </div>
      )}
    </section>
  );
}
