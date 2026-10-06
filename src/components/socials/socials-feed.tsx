"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import {
  addAuthenticatedSocialComment,
  deleteAuthenticatedSocialPost,
  loadAuthenticatedSocialPosts,
  reportAuthenticatedSocialPost,
  type SocialPostReportReason,
  toggleAuthenticatedPostLike,
  updateAuthenticatedSocialCaption,
} from "@/lib/authenticated-socials";
import {
  addSocialComment,
  loadSocialPosts,
  loadSocialRecording,
  toggleSocialPostLike,
  type SocialComment,
  type SocialPost,
} from "@/lib/social-posts";
import { SocialPostComposer } from "@/components/socials/social-post-composer";
import { SocialPostMedia } from "@/components/socials/social-post-media";

type PostWithRecording = {
  post: SocialPost;
  recordingUrl: string;
  recordingError: string;
};

function SocialAvatar({ avatar }: { avatar: string }) {
  return avatar.startsWith("https://")
    ? <Image alt="" className="social-avatar social-avatar-image" height={42} src={avatar} unoptimized width={42} />
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
  const [feedRevision, setFeedRevision] = useState(0);
  const [remoteOffset, setRemoteOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [captionDraft, setCaptionDraft] = useState("");
  const [reportingPostId, setReportingPostId] = useState<string | null>(null);
  const [reportReason, setReportReason] =
    useState<SocialPostReportReason>("inappropriate");
  const [reportDetails, setReportDetails] = useState("");

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
        let nextOffset = 0;
        let nextHasMore = false;
        if (authStatus === "signed-in" && userId) {
          try {
            const result = await loadAuthenticatedSocialPosts();
            remoteEntries = result.posts.map(({ post, recordingUrl }) => ({
              post,
              recordingUrl,
              recordingError: recordingUrl ? "" : "The performance recording is unavailable.",
            }));
            nextOffset = result.posts.length;
            nextHasMore = result.hasMore;
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
          setRemoteOffset(nextOffset);
          setHasMore(nextHasMore);
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
  }, [authStatus, feedRevision, userId]);

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    setLoadError("");
    try {
      const result = await loadAuthenticatedSocialPosts(remoteOffset);
      const entries = result.posts.map(({ post, recordingUrl }) => ({
        post,
        recordingUrl,
        recordingError: recordingUrl ? "" : "The performance recording is unavailable.",
      }));
      setPosts((current) => {
        const ids = new Set(current.map(({ post }) => post.id));
        return [...current, ...entries.filter(({ post }) => !ids.has(post.id))]
          .sort((left, right) => right.post.createdAt.localeCompare(left.post.createdAt));
      });
      setRemoteOffset((offset) => offset + result.posts.length);
      setHasMore(result.hasMore);
    } catch (error: unknown) {
      setLoadError(error instanceof Error
        ? error.message
        : "More performances could not be loaded.");
    } finally {
      setLoadingMore(false);
    }
  }

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

  async function saveCaption(post: SocialPost) {
    if (!post.isRemote) return;
    setActionError("");
    try {
      await updateAuthenticatedSocialCaption(post.id, captionDraft.trim());
      updatePost({ ...post, caption: captionDraft.trim() });
      setEditingPostId(null);
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : "The caption could not be updated.");
    }
  }

  async function deletePost(post: SocialPost) {
    if (!post.isRemote || !window.confirm("Delete this post and its media?")) return;
    setActionError("");
    try {
      await deleteAuthenticatedSocialPost(post.id);
      setPosts((current) => current.filter((entry) => entry.post.id !== post.id));
      setRemoteOffset((offset) => Math.max(0, offset - 1));
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : "The post could not be deleted.");
    }
  }

  async function submitReport(event: FormEvent<HTMLFormElement>, post: SocialPost) {
    event.preventDefault();
    if (!post.isRemote) return;
    setActionError("");
    try {
      await reportAuthenticatedSocialPost(
        post.id,
        reportReason,
        reportDetails,
      );
      setReportingPostId(null);
      setReportDetails("");
      setActionError("Thanks. Your report was submitted.");
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : "The post could not be reported.");
    }
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
      <SocialPostComposer onPosted={() => setFeedRevision((revision) => revision + 1)} />
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
                {post.authorId
                  ? <Link href={`/artists/${post.authorId}`}><strong>{post.username}</strong></Link>
                  : <strong>{post.username}</strong>}
                <time dateTime={post.createdAt}>
                  {new Intl.DateTimeFormat(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(post.createdAt))}
                </time>
              </div>
              {post.isRemote && (
                <details className="social-post-menu">
                  <summary aria-label="Post options">•••</summary>
                  <div>
                    {post.authorId === userId ? (
                      <>
                        <button
                          onClick={() => {
                            setEditingPostId(post.id);
                            setCaptionDraft(post.caption);
                          }}
                          type="button"
                        >
                          Edit caption
                        </button>
                        <button onClick={() => void deletePost(post)} type="button">Delete post</button>
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          setReportingPostId(reportingPostId === post.id ? null : post.id);
                          setReportDetails("");
                        }}
                        type="button"
                      >
                        Report post
                      </button>
                    )}
                  </div>
                </details>
              )}
            </header>
            <div className="social-post-song">
              <h2>{post.songTitle}</h2>
              <p>{post.artist}</p>
            </div>
            {editingPostId === post.id ? (
              <form
                className="social-caption-edit"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveCaption(post);
                }}
              >
                <textarea
                  maxLength={500}
                  onChange={(event) => setCaptionDraft(event.target.value)}
                  rows={3}
                  value={captionDraft}
                />
                <button className="button button-secondary" type="submit">SAVE CAPTION</button>
                <button className="button button-text" onClick={() => setEditingPostId(null)} type="button">CANCEL</button>
              </form>
            ) : post.caption ? <p className="social-post-caption">{post.caption}</p> : null}
            <SocialPostMedia
              mediaType={post.mediaType ?? "audio"}
              title={`${post.username}'s ${post.songTitle}`}
              url={recordingUrl}
            />
            {!recordingUrl && <p className="socials-error" role="alert">{recordingError}</p>}
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
            {reportingPostId === post.id && (
              <form className="social-report-form" onSubmit={(event) => void submitReport(event, post)}>
                <label>
                  <span>REPORT REASON</span>
                  <select
                    onChange={(event) => setReportReason(event.target.value as SocialPostReportReason)}
                    value={reportReason}
                  >
                    <option value="spam">Spam</option>
                    <option value="harassment">Harassment</option>
                    <option value="inappropriate">Inappropriate content</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <textarea
                  maxLength={500}
                  onChange={(event) => setReportDetails(event.target.value)}
                  placeholder="Additional details (optional)"
                  rows={2}
                  value={reportDetails}
                />
                <button className="button button-secondary" type="submit">SUBMIT REPORT</button>
              </form>
            )}
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
      {!loading && hasMore && (
        <button
          className="button button-secondary socials-load-more"
          disabled={loadingMore}
          onClick={() => void loadMore()}
          type="button"
        >
          {loadingMore ? "LOADING…" : "LOAD MORE"}
        </button>
      )}
    </section>
  );
}
