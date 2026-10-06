import { NextResponse } from "next/server";
import type { KaraokeVideo } from "@/lib/search-types";

const MAX_RESULTS = 12;
const MAX_QUERY_LENGTH = 150;
const MAX_PAGE_TOKEN_LENGTH = 2048;

function jsonResponse(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function karaokeQuery(query: string) {
  const isAlreadyFocused = /\b(karaoke|instrumental|sing[\s-]?along|minus[\s-]?one|backing[\s-]?track)\b/i.test(
    query,
  );
  return isAlreadyFocused ? query : `${query} karaoke`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringField(value: unknown, key: string) {
  return isRecord(value) && typeof value[key] === "string"
    ? value[key]
    : undefined;
}

function mapVideos(items: unknown[]): KaraokeVideo[] {
  return items
    .slice(0, MAX_RESULTS)
    .flatMap((item): KaraokeVideo[] => {
      if (!isRecord(item)) return [];
      const videoId = stringField(item.id, "videoId");
      const snippet = item.snippet;
      const title = stringField(snippet, "title");
      const channelTitle = stringField(snippet, "channelTitle");
      const publishedAt = stringField(snippet, "publishedAt");
      const thumbnails = isRecord(snippet) ? snippet.thumbnails : undefined;
      const thumbnail = [
        stringField(isRecord(thumbnails) ? thumbnails.high : undefined, "url"),
        stringField(isRecord(thumbnails) ? thumbnails.medium : undefined, "url"),
        stringField(isRecord(thumbnails) ? thumbnails.default : undefined, "url"),
      ].find((url) => url?.startsWith("https://i.ytimg.com/"));

      if (
        !videoId ||
        !title ||
        !channelTitle ||
        !thumbnail
      ) {
        return [];
      }

      return [{
        videoId,
        title,
        channelTitle,
        thumbnail,
        ...(publishedAt ? { publishedAt } : {}),
      }];
    });
}

function embeddableVideoIds(items: unknown[]) {
  return new Set(
    items.flatMap((item) => {
      if (!isRecord(item)) return [];
      const videoId = stringField(item, "id");
      const status = item.status;
      const privacyStatus = stringField(status, "privacyStatus");

      return videoId &&
        isRecord(status) &&
        status.embeddable === true &&
        (privacyStatus === "public" || privacyStatus === "unlisted")
        ? [videoId]
        : [];
    }),
  );
}

function youtubeErrorResponse(data: unknown) {
  const error = isRecord(data) && isRecord(data.error) ? data.error : undefined;
  const errors = error && Array.isArray(error.errors) ? error.errors : [];
  const isQuotaError = errors.some((item) =>
    /quota|dailylimit/i.test(stringField(item, "reason") ?? ""),
  );

  return jsonResponse(
    {
      error: {
        code: isQuotaError ? "quota_exceeded" : "youtube_api_error",
        message: isQuotaError
          ? "YouTube search is temporarily unavailable. Please try again later."
          : "Karaoke search is temporarily unavailable. Please try again.",
      },
    },
    isQuotaError ? 503 : 502,
  );
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const query = searchParams.get("q")?.trim() ?? "";
  const pageToken = searchParams.get("pageToken")?.trim();

  if (!query) {
    return jsonResponse(
      { error: { code: "empty_query", message: "Enter a song title or artist to search." } },
      400,
    );
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return jsonResponse(
      { error: { code: "query_too_long", message: "Search terms must be 150 characters or fewer." } },
      400,
    );
  }
  if (pageToken !== undefined && (!pageToken || pageToken.length > MAX_PAGE_TOKEN_LENGTH)) {
    return jsonResponse(
      { error: { code: "invalid_page_token", message: "The next results page could not be loaded. Please search again." } },
      400,
    );
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return jsonResponse(
      {
        error: {
          code: "not_configured",
          message: "YouTube search is not configured yet. Add YOUTUBE_API_KEY to the environment.",
        },
      },
      503,
    );
  }

  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  const youtubeParams = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: String(MAX_RESULTS),
    q: karaokeQuery(query),
    key: apiKey,
  });
  if (pageToken) youtubeParams.set("pageToken", pageToken);
  url.search = youtubeParams.toString();

  let response: Response;
  try {
    response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return jsonResponse(
      { error: { code: "upstream_unavailable", message: "Karaoke search is temporarily unavailable. Please try again." } },
      502,
    );
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return jsonResponse(
      { error: { code: "invalid_response", message: "Karaoke search returned an unexpected response. Please try again." } },
      502,
    );
  }

  if (!response.ok) {
    return youtubeErrorResponse(data);
  }

  if (!isRecord(data) || !Array.isArray(data.items)) {
    return jsonResponse(
      { error: { code: "invalid_response", message: "Karaoke search returned an unexpected response. Please try again." } },
      502,
    );
  }

  const nextPageToken = stringField(data, "nextPageToken");
  const videos = mapVideos(data.items);
  if (videos.length === 0) {
    return jsonResponse({
      videos,
      ...(nextPageToken ? { nextPageToken } : {}),
    });
  }

  const statusUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  statusUrl.search = new URLSearchParams({
    part: "status",
    id: videos.map((video) => video.videoId).join(","),
    key: apiKey,
  }).toString();

  let statusResponse: Response;
  try {
    statusResponse = await fetch(statusUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return jsonResponse(
      { error: { code: "upstream_unavailable", message: "Karaoke search is temporarily unavailable. Please try again." } },
      502,
    );
  }

  let statusData: unknown;
  try {
    statusData = await statusResponse.json();
  } catch {
    return jsonResponse(
      { error: { code: "invalid_response", message: "Karaoke search returned an unexpected response. Please try again." } },
      502,
    );
  }

  if (!statusResponse.ok) {
    return youtubeErrorResponse(statusData);
  }
  if (!isRecord(statusData) || !Array.isArray(statusData.items)) {
    return jsonResponse(
      { error: { code: "invalid_response", message: "Karaoke search returned an unexpected response. Please try again." } },
      502,
    );
  }

  const playableIds = embeddableVideoIds(statusData.items);
  return jsonResponse({
    videos: videos.filter((video) => playableIds.has(video.videoId)),
    ...(nextPageToken ? { nextPageToken } : {}),
  });
}
