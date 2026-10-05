type YouTubePlayerOptions = {
  videoId: string;
  playerVars?: Record<string, number | string>;
  events?: {
    onError?: (event: { data: number }) => void;
  };
};

type YouTubePlayerInstance = {
  destroy: () => void;
};

type YouTubeIframeAPI = {
  Player: new (
    element: HTMLElement,
    options: YouTubePlayerOptions,
  ) => YouTubePlayerInstance;
};

declare global {
  interface Window {
    YT?: YouTubeIframeAPI;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export {};
