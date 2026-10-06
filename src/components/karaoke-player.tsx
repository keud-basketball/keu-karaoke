"use client";

import Script from "next/script";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

type KaraokePlayerProps = {
  videoId: string;
  onError?: (videoId: string) => void;
  unavailable?: boolean;
};

export function KaraokePlayer({
  videoId,
  onError,
  unavailable = false,
}: KaraokePlayerProps) {
  const playerTarget = useRef<HTMLDivElement>(null);
  const playerInstance = useRef<{ destroy: () => void } | null>(null);
  const onErrorRef = useRef(onError);
  const [apiLoaded, setApiLoaded] = useState(
    () => typeof window !== "undefined" && Boolean(window.YT?.Player),
  );
  const [unavailableFor, setUnavailableFor] = useState<string | null>(null);

  useLayoutEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useLayoutEffect(() => {
    const previousReadyCallback = window.onYouTubeIframeAPIReady;
    const handleApiReady = () => {
      previousReadyCallback?.();
      setApiLoaded(true);
    };
    window.onYouTubeIframeAPIReady = handleApiReady;
    window.onYouTubeIframeAPIReady = handleApiReady;

    return () => {
      if (window.onYouTubeIframeAPIReady === handleApiReady) {
        window.onYouTubeIframeAPIReady = previousReadyCallback;
      }
    };
  }, []);

  useEffect(() => {
    if (!apiLoaded || !playerTarget.current || !window.YT?.Player) {
      return;
    }

    playerInstance.current?.destroy();
    playerInstance.current = new window.YT.Player(playerTarget.current, {
      videoId,
      playerVars: {
        autoplay: 1,
        playsinline: 1,
        origin: window.location.origin,
      },
      events: {
        onError: () => {
          if (onErrorRef.current) {
            onErrorRef.current(videoId);
          } else {
            setUnavailableFor(videoId);
          }
        },
      },
    });

    return () => {
      playerInstance.current?.destroy();
      playerInstance.current = null;
    };
  }, [apiLoaded, videoId]);

  return (
    <>
      <Script
        src="https://www.youtube.com/iframe_api"
        strategy="afterInteractive"
        onReady={() => {
          if (window.YT?.Player) setApiLoaded(true);
        }}
        onError={() => setUnavailableFor(videoId)}
      />
      <div className="player-frame">
        <div className="player-target" ref={playerTarget} />
        {(unavailableFor === videoId || unavailable) && (
          <div className="player-unavailable" role="alert">
            <span className="state-icon" aria-hidden="true">!</span>
            <p>This video cannot be played inside KEU. Please choose another karaoke result.</p>
          </div>
        )}
      </div>
    </>
  );
}
