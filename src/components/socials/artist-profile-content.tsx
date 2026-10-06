"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { SocialPostMedia } from "@/components/socials/social-post-media";
import {
  loadArtistProfile,
  loadAuthenticatedSocialPosts,
  toggleProfileFollow,
  type ArtistProfile,
  type RemoteSocialPost,
} from "@/lib/authenticated-socials";

const PAGE_SIZE = 20;

export function ArtistProfileContent({ userId }: { userId: string }) {
  const { authStatus, userId: currentUserId } = useAuth();
  const [profile, setProfile] = useState<ArtistProfile | null>(null);
  const [posts, setPosts] = useState<RemoteSocialPost[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [updatingFollow, setUpdatingFollow] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [artist, result] = await Promise.all([
          loadArtistProfile(userId),
          loadAuthenticatedSocialPosts(0, PAGE_SIZE, userId),
        ]);
        if (!cancelled) {
          setProfile(artist);
          setPosts(result.posts);
          setHasMore(result.hasMore);
        }
      } catch (reason: unknown) {
        if (!cancelled) {
          setError(reason instanceof Error
            ? reason.message
            : "The artist profile could not be loaded.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (authStatus === "signed-in") void load();
    return () => {
      cancelled = true;
    };
  }, [authStatus, userId]);

  async function toggleFollow() {
    if (!profile || updatingFollow) return;
    setUpdatingFollow(true);
    setError("");
    const wasFollowing = profile.followedByMe;
    setProfile({
      ...profile,
      followedByMe: !wasFollowing,
      followers: profile.followers + (wasFollowing ? -1 : 1),
    });
    try {
      await toggleProfileFollow(userId, wasFollowing);
    } catch (reason: unknown) {
      setProfile(profile);
      setError(reason instanceof Error ? reason.message : "Your follow could not be saved.");
    } finally {
      setUpdatingFollow(false);
    }
  }

  async function loadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const result = await loadAuthenticatedSocialPosts(posts.length, PAGE_SIZE, userId);
      setPosts((current) => {
        const ids = new Set(current.map(({ post }) => post.id));
        return [...current, ...result.posts.filter(({ post }) => !ids.has(post.id))];
      });
      setHasMore(result.hasMore);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "More posts could not be loaded.");
    } finally {
      setLoadingMore(false);
    }
  }

  if (authStatus !== "signed-in") {
    return (
      <section className="state-card">
        <h1>Sign in to view artist profiles</h1>
        <Link className="button button-play" href="/login?next=%2Fsocials">SIGN IN WITH GOOGLE</Link>
      </section>
    );
  }
  if (loading) return <p className="account-status" role="status">Loading artist profile…</p>;

  return (
    <section className="artist-profile">
      {error && <p className="socials-error" role="alert">{error}</p>}
      {!profile ? (
        <div className="state-card">
          <h1>Artist profile unavailable</h1>
          <Link href="/socials">BACK TO SOCIALS</Link>
        </div>
      ) : (
        <>
          <header className="artist-profile-header">
            {profile.avatarUrl
              ? <Image alt="" className="profile-avatar" height={96} src={profile.avatarUrl} unoptimized width={96} />
              : <div aria-hidden="true" className="profile-avatar profile-avatar-fallback">🎤</div>}
            <div>
              <p className="eyebrow">RECORDING ARTIST</p>
              <h1>{profile.artistName}</h1>
              <p className="artist-profile-counts">
                {profile.followers} followers · {profile.following} following
              </p>
            </div>
            {currentUserId !== userId && (
              <button className="button button-play" disabled={updatingFollow} onClick={() => void toggleFollow()} type="button">
                {updatingFollow ? "SAVING…" : profile.followedByMe ? "FOLLOWING" : "FOLLOW"}
              </button>
            )}
          </header>
          <h2 className="artist-posts-heading">Posts</h2>
          {posts.length === 0 ? (
            <div className="socials-empty"><p>This artist has not posted yet.</p></div>
          ) : (
            <div className="socials-post-list">
              {posts.map(({ post, recordingUrl }) => (
                <article className="social-post-card" key={post.id}>
                  <div className="social-post-song">
                    <h2>{post.songTitle}</h2>
                    <p>{post.artist}</p>
                  </div>
                  {post.caption && <p className="social-post-caption">{post.caption}</p>}
                  <SocialPostMedia
                    mediaType={post.mediaType ?? "audio"}
                    title={`${post.username}'s ${post.songTitle}`}
                    url={recordingUrl}
                  />
                </article>
              ))}
            </div>
          )}
          {hasMore && (
            <button
              className="button button-secondary socials-load-more"
              disabled={loadingMore}
              onClick={() => void loadMore()}
              type="button"
            >
              {loadingMore ? "LOADING…" : "LOAD MORE"}
            </button>
          )}
        </>
      )}
    </section>
  );
}
