"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { createAuthenticatedSocialPost } from "@/lib/authenticated-socials";

const mediaTypes: Record<string, "photo" | "video"> = {
  "image/jpeg": "photo",
  "image/png": "photo",
  "image/webp": "photo",
  "video/mp4": "video",
  "video/webm": "video",
};

type SocialPostComposerProps = {
  onPosted: () => void;
};

export function SocialPostComposer({ onPosted }: SocialPostComposerProps) {
  const { authStatus, profile, profileLoading } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [songTitle, setSongTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");
  const [posting, setPosting] = useState(false);

  if (authStatus !== "signed-in" || profileLoading || !profile) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || posting) return;
    setError("");
    setPosting(true);
    const mediaType = mediaTypes[file.type];
    if (!mediaType) {
      setError("Choose a JPEG, PNG, WebP, MP4, or WebM file.");
      setPosting(false);
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError("Choose a file smaller than 50 MB.");
      setPosting(false);
      return;
    }

    try {
      await createAuthenticatedSocialPost(
        {
          songTitle: songTitle.trim() || (mediaType === "photo" ? "Photo post" : "Video post"),
          artist: artist.trim() || "Artist not listed",
          caption: caption.trim(),
        },
        file,
        mediaType,
      );
      setFile(null);
      setSongTitle("");
      setArtist("");
      setCaption("");
      onPosted();
    } catch (reason: unknown) {
      setError(reason instanceof Error
        ? reason.message
        : "Your post could not be saved. Please try again.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <form className="social-post-composer" onSubmit={(event) => void submit(event)}>
      <div>
        <p className="eyebrow">SHARE WITH THE COMMUNITY</p>
        <h2>Create a post</h2>
      </div>
      <label>
        <span>PHOTO OR VIDEO</span>
        <input
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
          onChange={(event) => {
            setFile(event.currentTarget.files?.[0] ?? null);
            setError("");
          }}
          type="file"
        />
      </label>
      <label>
        <span>SONG OR POST TITLE (OPTIONAL)</span>
        <input
          maxLength={200}
          onChange={(event) => setSongTitle(event.target.value)}
          value={songTitle}
        />
      </label>
      <label>
        <span>ARTIST (OPTIONAL)</span>
        <input
          maxLength={120}
          onChange={(event) => setArtist(event.target.value)}
          value={artist}
        />
      </label>
      <label>
        <span>CAPTION</span>
        <textarea
          maxLength={500}
          onChange={(event) => setCaption(event.target.value)}
          rows={3}
          value={caption}
        />
      </label>
      {error && <p className="socials-error" role="alert">{error}</p>}
      <button className="button button-play" disabled={!file || posting} type="submit">
        {posting ? "POSTING…" : "SHARE POST"}
      </button>
    </form>
  );
}
