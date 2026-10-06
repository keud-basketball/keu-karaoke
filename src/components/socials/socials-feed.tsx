"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import {
  addAuthenticatedSocialComment,
  loadAuthenticatedSocialPosts,
  toggleAuthenticatedPostLike,
} from "@/lib/authenticated-socials";
import {
  addSocialComment,
  loadSocialPosts,
  loadSocialRecording,
  toggleSocialPostLike,
  type SocialComment,
  type SocialPost,
} from "@/lib/social-posts";

type PostWithRecording = {
  post: SocialPost;
  recordingUrl: string;
  recordingError: string;
};

function SocialAvatar({ avatar }: { avatar: string }) {
  return avatar.startsWith("https://")
    ? <img alt="" className="social-avatar social-avatar-image" src={avatar} />
    : <div aria-hidden="true" className="social-avatar">{avatar}</div>;
}

export function SocialsFeed() {
  const { authStatus, configured, profile, userId } = useAuth();
  const [posts, setPosts] = useState<PostWithRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [shareNotice, setShareNotice] = useState<{ postId: string; link: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const createdUrls: string[] = [];

    async function loadFeed() {
      setLoading(true);
      setLoadError("");
      try {
        const savedPosts = await loadSocialPosts();
        const localEntries = await Promise.all(savedPosts.map(async (post) => {
          try {
            const recording = await loadSocialRecording(post.id);
            if (!recording) {
              return { post, recordingUrl: "", recordingError: "The saved performance recording is unavailable." };
            }
            const recordingUrl = URL.createObjectURL(recording);
            createdUrls.push(recordingUrl);
            return { post, recordingUrl, recordingError: "" };
          } catch (error: unknown) {
            return {
              post,
              recordingUrl: "",
              recordingError: error instanceof Error
                ? `The performance recording could not be loaded: ${error.message}`
                : "The performance recording could not be loaded.",
            };
          }
        }));

        let remoteEntries: PostWithRecording[] = [];
        let remoteError = "";
        if (authStatus === "signed-in" && userId) {
          try {
            const remotePosts = await loadAuthenticatedSocialPosts();
            remoteEntries = remotePosts.map(({ post, recordingUrl }) => ({
              post,
              recordingUrl,
              recordingError: recordingUrl ? "" : "The performance recording is unavailable.",
            }));
          } catch (error: unknown) {
            remoteError = error instanceof Error
              ? error.message
              : "The KEURAOKE Socials feed could not be loaded.";
          }
        }
        if (!cancelled) {
          const entries = [...localEntries, ...remoteEntries].sort((left, right) => (
            right.post.createdAt.localeCompare(left.post.createdAt)
          ));
          setPosts(entries);
          setLoadError(remoteError);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setLoadError(error instanceof Error
            ? `Socials could not be loaded: ${error.message}`
            : "Socials could not be loaded.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadFeed();
    return () => {
      cancelled = true;
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [authStatus, userId]);

  function updatePost(updatedPost: SocialPost) {
    setPosts((currentPosts) => currentPosts.map((entry) => (
      entry.post.id === updatedPost.id ? { ...entry, post: updatedPost } : entry
    )));
  }

  async function likePost(post: SocialPost) {
    setActionError("");
    try {
      if (post.isRemote) {
        if (authStatus !== "signed-in") {
          throw new Error("Sign in with Google to like community performances.");
        }
        await toggleAuthenticatedPostLike(post.id, post.likedByMe);
        updatePost({
          ...post,
          likes: post.likes + (post.likedByMe ? -1 : 1),
          likedByMe: !post.likedByMe,
        });
      } else {
        updatePost(toggleSocialPostLike(post.id));
      }
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : "The post could not be updated.");
    }
  }

  async function submitComment(event: FormEvent<HTMLFormElement>, post: SocialPost) {
    event.preventDefault();
    const text = commentDrafts[post.id]?.trim();
    if (!text) return;
    setActionError("");
    try {
      let updatedPost: SocialPost;
      if (post.isRemote) {
        if (authStatus !== "signed-in") {
          throw new Error("Sign in with Google to comment on community performances.");
        }
        await addAuthenticatedSocialComment(post.id, text);
        const comment: SocialComment = {
          id: crypto.randomUUID(),
          username: profile?.artist_name ?? "KEURAOKE Singer",
          text,
          createdAt: new Date().toISOString(),
        };
        updatedPost = { ...post, comments: [...post.comments, comment] };
      } else {
        updatedPost = addSocialComment(post.id, text);
      }
      updatePost(updatedPost);
      setCommentDrafts((drafts) => ({ ...drafts, [post.id]: "" }));
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : "Your comment could not be saved.");
    }
  }

  async function sharePost(postId: string) {
    const link = `${window.location.origin}/socials#post-${encodeURIComponent(postId)}`;
    setShareNotice(null);
    if (navigator.share) {
      try {
        await navigator.share({ title: "KEURAOKE Socials", text: "Check out this KEURAOKE performance.", url: link });
        return;
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard access is unavailable.");
      await navigator.clipboard.writeText(link);
    } catch {
      setShareNotice({ postId, link });
      return;
    }
    setShareNotice({ postId, link: "Post link copied." });
  }

  return (
    <section aria-labelledby="socials-heading" className="socials-section">
      <div className="socials-heading">
        <p className="eyebrow">SING IT. SHARE IT.</p>
        <h1 id="socials-heading">🌐 KEURAOKE SOCIALS</h1>
        <p>User performance posts from the KEURAOKE community.</p>
      </div>

      {authStatus !== "signed-in" && (
        <div className="socials-auth-notice">
          <p>
            Sign in with Google to see community performances and post your own recording.{" "}
            <Link href={configured ? "/login?next=%2Fsocials" : "/login"}>SIGN IN</Link>
          </p>
        </div>
      )}
      {loadError && <p className="socials-error" role="alert">{loadError}</p>}
      {actionError && <p className="socials-error" role="alert">{actionError}</p>}
      {loading && <p className="socials-empty" role="status">Loading performances…</p>}
      {!loading && !loadError && posts.length === 0 && (
        <div className="socials-empty">
          <span aria-hidden="true">🎤</span>
          <h2>No performances posted yet</h2>
          <p>Record your performance and post it here to get the Socials feed started.</p>
        </div>
      )}

      <div className="socials-post-list">
        {posts.map(({ post, recordingUrl, recordingError }) => (
          <article className="social-post-card" id={`post-${post.id}`} key={post.id}>
            <header className="social-post-header">
              <SocialAvatar avatar={post.avatar} />
              <div>
                <strong>{post.username}</strong>
                <time dateTime={post.createdAt}>
                  {new Intl.DateTimeFormat(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(post.createdAt))}
                </time>
              </div>
            </header>
            <div className="social-post-song">
              <h2>{post.songTitle}</h2>
              <p>{post.artist}</p>
            </div>
            {post.caption && <p className="social-post-caption">{post.caption}</p>}
            {recordingUrl
              ? <audio aria-label={`Play ${post.username}'s performance of ${post.songTitle}`} controls controlsList="nodownload" src={recordingUrl} />
              : <p className="socials-error" role="alert">{recordingError}</p>}
            <div className="social-post-actions">
              <button
                aria-pressed={post.likedByMe}
                className={`social-action${post.likedByMe ? " is-liked" : ""}`}
                onClick={() => void likePost(post)}
                type="button"
              >
                {post.likedByMe ? "❤️" : "🤍"} {post.likes}
              </button>
              <a className="social-action" href={`#comment-${post.id}`}>
                💬 {post.comments.length}
              </a>
              <button className="social-action" onClick={() => void sharePost(post.id)} type="button">
                🔗 SHARE KEURAOKE POST
              </button>
            </div>
            {shareNotice?.postId === post.id && (
              shareNotice.link === "Post link copied."
                ? <p className="social-share-message" role="status">{shareNotice.link}</p>
                : <label className="social-share-link">
                    <span>Copy this post link</span>
                    <input
                      onFocus={(event) => event.currentTarget.select()}
                      readOnly
                      value={shareNotice.link}
                    />
                  </label>
            )}
            <div className="social-comments" id={`comment-${post.id}`}>
              {post.comments.map((comment) => (
                <p className="social-comment" key={comment.id}>
                  <strong>{comment.username}</strong> {comment.text}
                </p>
              ))}
              <form className="social-comment-form" onSubmit={(event) => void submitComment(event, post)}>
                <input
                  aria-label={`Comment on ${post.songTitle}`}
                  onChange={(event) => setCommentDrafts((drafts) => ({
                    ...drafts,
                    [post.id]: event.target.value,
                  }))}
                  maxLength={500}
                  placeholder="Write a comment..."
                  value={commentDrafts[post.id] ?? ""}
                />
                <button className="button button-secondary" disabled={!commentDrafts[post.id]?.trim()} type="submit">
                  COMMENT
                </button>
              </form>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
