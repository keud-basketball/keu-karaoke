"use client";

import Image from "next/image";
import { useState } from "react";

type SocialPostMediaProps = {
  mediaType: "audio" | "photo" | "video";
  url: string;
  title: string;
};

export function SocialPostMedia({ mediaType, url, title }: SocialPostMediaProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!url) {
    return <p className="socials-error" role="alert">This post’s media is unavailable.</p>;
  }
  if (failedUrl === url) {
    return <p className="socials-error" role="alert">This post’s media is unavailable.</p>;
  }
  if (mediaType === "photo") {
    return (
      <Image
        alt={title}
        className="social-post-image"
        height={1200}
        loading="lazy"
        src={url}
        unoptimized
        onError={() => setFailedUrl(url)}
        width={900}
      />
    );
  }
  if (mediaType === "video") {
    return (
      <video
        aria-label={title}
        className="social-post-video"
        controls
        controlsList="nodownload"
        playsInline
        preload="metadata"
        src={url}
        onError={() => setFailedUrl(url)}
      />
    );
  }
  return (
    <audio
      aria-label={`Play ${title}`}
      controls
      controlsList="nodownload"
      onError={() => setFailedUrl(url)}
      preload="metadata"
      src={url}
    />
  );
}
