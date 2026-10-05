"use client";

import Image from "next/image";
import Link from "next/link";
import { useFavorites } from "@/lib/favorites";
import { decodeHtmlEntities } from "@/lib/decode-html-entities";

export function FavoritesSection() {
  const { favorites, remove, clear } = useFavorites();

  return (
    <section className="favorites-section" aria-labelledby="favorites-heading">
      <div className="favorites-heading">
        <h2 id="favorites-heading">❤️ My Karaoke</h2>
        {favorites.length > 0 && (
          <button className="favorites-clear" onClick={clear} type="button">
            Clear All
          </button>
        )}
      </div>
      {favorites.length === 0 ? (
        <p className="favorites-empty">Save your favorite karaoke songs here.</p>
      ) : (
        <div className="video-list">
          {favorites.map((video) => {
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
                    href={`/watch?id=${encodeURIComponent(video.videoId)}&title=${encodeURIComponent(title)}`}
                    aria-label={`Play karaoke video: ${title}`}
                  >
                    <span aria-hidden="true">▶</span> PLAY KARAOKE
                  </Link>
                  <button
                    className="button button-favorite-remove"
                    onClick={() => remove(video.videoId)}
                    type="button"
                  >
                    Remove Favorite
                  </button>
                </div>
              </div>
            </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
