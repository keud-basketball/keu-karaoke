"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useKaraokeQueue } from "@/lib/karaoke-queue";
import { decodeHtmlEntities } from "@/lib/decode-html-entities";

function watchHref(videoId: string, title: string, channelTitle: string) {
  return `/watch?id=${encodeURIComponent(videoId)}&title=${encodeURIComponent(title)}&channel=${encodeURIComponent(channelTitle)}`;
}

export function QueueSection({ showEmpty = false }: { showEmpty?: boolean }) {
  const router = useRouter();
  const { queue, remove, clear } = useKaraokeQueue();

  if (queue.length === 0 && !showEmpty) return null;

  function playNextSong() {
    if (queue.length < 2) return;
    const [currentSong, nextSong] = queue;
    if (!nextSong) return;
    remove(currentSong.videoId);
    router.push(watchHref(
      nextSong.videoId,
      decodeHtmlEntities(nextSong.title),
      decodeHtmlEntities(nextSong.channelTitle),
    ));
  }

  return (
    <section className="queue-section" aria-labelledby="queue-heading">
      <div className="queue-heading">
        <h2 id="queue-heading">🎤 UP NEXT</h2>
        {queue.length > 0 && (
          <div className="queue-controls">
            <button
              className="queue-action"
              disabled={queue.length < 2}
              onClick={playNextSong}
              type="button"
            >
              NEXT SONG
            </button>
            <button className="queue-action" onClick={clear} type="button">
              CLEAR QUEUE
            </button>
          </div>
        )}
      </div>
      {queue.length > 0 ? (
        <ol className="queue-list">
          {queue.map((video, index) => {
            const title = decodeHtmlEntities(video.title);
            const channelTitle = decodeHtmlEntities(video.channelTitle);
            return (
              <li className="queue-item" key={video.videoId}>
                <span className="queue-position">{index + 1}</span>
                <Image
                  alt=""
                  className="queue-thumbnail"
                  height={72}
                  src={video.thumbnail}
                  unoptimized
                  width={128}
                />
                <div className="queue-item-info">
                  <h3 title={title}>{title}</h3>
                  <p title={channelTitle}>{channelTitle}</p>
                </div>
                <div className="queue-item-actions">
                  <Link
                    className="queue-action queue-play"
                    href={watchHref(video.videoId, title, channelTitle)}
                  >
                    PLAY KARAOKE
                  </Link>
                  <button
                    className="queue-action"
                    onClick={() => remove(video.videoId)}
                    type="button"
                  >
                    REMOVE
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="favorites-empty">Songs you add will appear here.</p>
      )}
    </section>
  );
}
