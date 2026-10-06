"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { createAuthenticatedSocialPost } from "@/lib/authenticated-socials";

type PostRecordDialogProps = {
  songTitle: string;
  recordingBlob: Blob;
  recordingUrl: string;
  onClose: () => void;
  onPosted: () => void;
};

export function PostRecordDialog({
  songTitle,
  recordingBlob,
  recordingUrl,
  onClose,
  onPosted,
}: PostRecordDialogProps) {
  const { authStatus, configured, profile, avatarSrc, profileLoading, profileError } = useAuth();
  const [artist, setArtist] = useState("");
  const [caption, setCaption] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [posting, setPosting] = useState(false);

  async function submitPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (posting) return;

    setPosting(true);
    setErrorMessage("");
    try {
      await createAuthenticatedSocialPost(
        {
          songTitle,
          artist: artist.trim() || "Artist not listed",
          caption: caption.trim(),
        },
        recordingBlob,
      );
      onPosted();
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error
        ? `Your post could not be saved: ${error.message}`
        : "Your post could not be saved. Please try again.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="social-dialog-backdrop">
      <section
        aria-labelledby="post-record-heading"
        aria-modal="true"
        className="social-dialog"
        role="dialog"
      >
        <div className="social-dialog-heading">
          <div>
            <p className="eyebrow">KEURAOKE SOCIALS</p>
            <h2 id="post-record-heading">Post Your Record</h2>
          </div>
          <button
            aria-label="Close post dialog"
            className="social-dialog-close"
            disabled={posting}
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>
        <div className="social-post-preview">
          {avatarSrc
            ? <img alt="" className="social-avatar social-avatar-image" src={avatarSrc} />
            : <div aria-hidden="true" className="social-avatar">🎤</div>}
          <div>
            <strong>{profile?.artist_name ?? "Your Recording Artist Profile"}</strong>
            <p>{songTitle}</p>
            <p>Artist: {artist.trim() || "Artist not listed"}</p>
          </div>
        </div>
        <audio aria-label="Preview your performance recording" controls controlsList="nodownload" src={recordingUrl} />
        {authStatus !== "signed-in" && (
          <div className="socials-auth-notice">
            <p>
              {configured
                ? "Sign in with Google to post. Open login in a new tab so this microphone recording stays on this page."
                : "Google login is not configured yet. Add the Supabase project URL and anon key to enable posting."}
            </p>
            {configured && (
              <Link href="/login?next=%2Fprofile" rel="noreferrer" target="_blank">
                SIGN IN WITH GOOGLE
              </Link>
            )}
          </div>
        )}
        {authStatus === "signed-in" && profileLoading && (
          <p className="account-status" role="status">Loading your Recording Artist Profile…</p>
        )}
        {authStatus === "signed-in" && !profileLoading && !profile && (
          <div className="socials-auth-notice">
            <p>{profileError || "Create your Recording Artist Profile before posting."}</p>
            <Link href="/profile" rel="noreferrer" target="_blank">CREATE YOUR PROFILE</Link>
          </div>
        )}
        {authStatus === "signed-in" && profile && (
          <form className="social-post-form" onSubmit={submitPost}>
            <label>
              <span>SONG TITLE</span>
              <input aria-label="Song title" readOnly value={songTitle} />
            </label>
            <label>
              <span>ARTIST</span>
              <input
                onChange={(event) => setArtist(event.target.value)}
                placeholder="Artist not listed"
                value={artist}
              />
            </label>
            <label>
              <span>CAPTION (OPTIONAL)</span>
              <textarea
                onChange={(event) => setCaption(event.target.value)}
                maxLength={500}
                placeholder="Add a caption..."
                rows={3}
                value={caption}
              />
            </label>
            {errorMessage && <p className="social-form-error" role="alert">{errorMessage}</p>}
            <div className="social-dialog-actions">
              <button className="button button-secondary" disabled={posting} onClick={onClose} type="button">
                CANCEL
              </button>
              <button className="button button-play" disabled={posting} type="submit">
                {posting ? "POSTING…" : "POST"}
              </button>
            </div>
          </form>
        )}
        {authStatus !== "signed-in" && (
          <div className="social-dialog-actions">
            <button className="button button-secondary" onClick={onClose} type="button">CLOSE</button>
          </div>
        )}
      </section>
    </div>
  );
}
