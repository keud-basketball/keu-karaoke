import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import type { SocialPost } from "@/lib/social-posts";

type AuthenticatedClient = SupabaseClient<Database>;
type PostRow = Database["public"]["Tables"]["social_posts"]["Row"];
type LikeRow = Database["public"]["Tables"]["social_post_likes"]["Row"];
type CommentRow = Database["public"]["Tables"]["social_post_comments"]["Row"];
type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "auth_user_id" | "artist_name" | "avatar_url"
>;
type SocialMediaType = Database["public"]["Tables"]["social_posts"]["Row"]["media_type"];
export type SocialPostReportReason =
  Database["public"]["Tables"]["social_post_reports"]["Row"]["reason"];

export type RemoteSocialPost = {
  post: SocialPost;
  recordingUrl: string;
};

export type ArtistProfile = {
  userId: string;
  artistName: string;
  avatarUrl: string;
  followers: number;
  following: number;
  followedByMe: boolean;
};

function requireClient() {
  const client = createSupabaseBrowserClient();
  if (!client) {
    throw new Error("Socials needs Supabase configuration. Add the public project URL and anon key.");
  }
  return client;
}

async function requireUser(client: AuthenticatedClient) {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new Error("Your sign-in session expired. Sign in with Google and try again.");
  }
  return data.user;
}

function displayName(profiles: Map<string, ProfileRow>, userId: string) {
  return profiles.get(userId)?.artist_name ?? "KEURAOKE Singer";
}

async function matchesMediaSignature(media: Blob, contentType: string) {
  const bytes = new Uint8Array(await media.slice(0, 12).arrayBuffer());
  const text = (start: number, end: number) =>
    String.fromCharCode(...bytes.slice(start, end));

  switch (contentType) {
    case "image/jpeg":
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/png":
      return bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
    case "image/webp":
      return text(0, 4) === "RIFF" && text(8, 12) === "WEBP";
    case "video/mp4":
    case "audio/mp4":
      return text(4, 8) === "ftyp";
    case "video/webm":
    case "audio/webm":
      return bytes.slice(0, 4).join(",") === "26,69,223,163";
    case "audio/ogg":
      return text(0, 4) === "OggS";
    case "audio/wav":
      return text(0, 4) === "RIFF" && text(8, 12) === "WAVE";
    case "audio/mpeg":
      return text(0, 3) === "ID3" ||
        (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
    default:
      return false;
  }
}

async function signedUrlMap(
  client: AuthenticatedClient,
  bucket: "avatars" | "social-recordings",
  paths: string[],
) {
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  if (uniquePaths.length === 0) return new Map<string, string>();

  const { data, error } = await client.storage.from(bucket).createSignedUrls(uniquePaths, 3600);
  if (error) {
    throw new Error(bucket === "avatars"
      ? "Artist profile pictures could not be loaded. Check your connection and try again."
      : "Socials recordings could not be loaded. Check your connection and try again.");
  }

  const urls = new Map<string, string>();
  for (const item of data) {
    if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  }
  return urls;
}

export async function loadAuthenticatedSocialPosts(
  offset = 0,
  pageSize = 20,
  authorId?: string,
): Promise<{ posts: RemoteSocialPost[]; hasMore: boolean }> {
  const client = requireClient();
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError) {
    throw new Error("Your sign-in session could not be verified. Sign in again or check your connection.");
  }
  if (!user) return { posts: [], hasMore: false };

  let postsQuery = client
    .from("social_posts")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);
  if (authorId) postsQuery = postsQuery.eq("auth_user_id", authorId);

  const { data: postRows, error: postsError } = await postsQuery;
  if (postsError) {
    throw new Error("The KEURAOKE Socials feed could not be loaded. Check your connection and try again.");
  }
  const posts: PostRow[] = postRows;
  if (posts.length === 0) return { posts: [], hasMore: false };

  const postIds = posts.map(({ id }) => id);
  const userIds = [...new Set(posts.map(({ auth_user_id }) => auth_user_id))];
  const [likeResult, commentResult] = await Promise.all([
    client.from("social_post_likes").select("*").in("post_id", postIds),
    client.from("social_post_comments").select("*").in("post_id", postIds).order("created_at"),
  ]);
  if (likeResult.error || commentResult.error) {
    throw new Error("Likes and comments could not be loaded. Check your connection and try again.");
  }
  const likes: LikeRow[] = likeResult.data;
  const comments: CommentRow[] = commentResult.data;
  const profileUserIds = [...new Set([
    ...userIds,
    ...comments.map(({ auth_user_id }) => auth_user_id),
  ])];
  const { data: profileRows, error: profileError } = await client
    .from("profiles")
    .select("auth_user_id,artist_name,avatar_url")
    .in("auth_user_id", profileUserIds);
  if (profileError) {
    throw new Error("Recording artist profiles could not be loaded. Check your connection and try again.");
  }
  const profiles = new Map<string, ProfileRow>(profileRows.map((row) => [row.auth_user_id, row]));
  const [recordingUrls, avatarUrls] = await Promise.all([
    signedUrlMap(client, "social-recordings", posts.map(({ recording_path }) => recording_path)),
    signedUrlMap(client, "avatars", profileRows.flatMap(({ avatar_url }) => avatar_url ? [avatar_url] : [])),
  ]);

  const remotePosts = posts.map((row) => {
    const author = profiles.get(row.auth_user_id);
    const avatar = author?.avatar_url ? avatarUrls.get(author.avatar_url) : null;
    return {
      post: {
        id: row.id,
        authorId: row.auth_user_id,
        username: displayName(profiles, row.auth_user_id),
        avatar: avatar ?? "🎤",
        isRemote: true,
        mediaType: row.media_type,
        songTitle: row.song_title,
        artist: row.artist,
        caption: row.caption,
        createdAt: row.created_at,
        likes: likes.filter((like) => like.post_id === row.id).length,
        likedByMe: likes.some((like) => like.post_id === row.id && like.auth_user_id === user.id),
        comments: comments
          .filter((comment) => comment.post_id === row.id)
          .map((comment) => ({
            id: comment.id,
            username: displayName(profiles, comment.auth_user_id),
            text: comment.content,
            createdAt: comment.created_at,
          })),
      },
      recordingUrl: recordingUrls.get(row.recording_path) ?? "",
    };
  });
  return { posts: remotePosts, hasMore: posts.length === pageSize };
}

export async function createAuthenticatedSocialPost(
  details: Pick<SocialPost, "songTitle" | "artist" | "caption">,
  media: Blob,
  mediaType: SocialMediaType = "audio",
) {
  if (media.size === 0 || media.size > 50 * 1024 * 1024) {
    throw new Error("This media is empty or too large. Keep it under 50 MB and try again.");
  }
  const client = requireClient();
  const user = await requireUser(client);
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("auth_user_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (profileError || !profile) {
    throw new Error("Create your Recording Artist Profile before posting a performance.");
  }

  const postId = crypto.randomUUID();
  const contentType = media.type.split(";")[0].toLowerCase();
  const extensions: Record<string, { extension: string; mediaType: SocialMediaType }> = {
    "audio/webm": { extension: "webm", mediaType: "audio" },
    "audio/mp4": { extension: "m4a", mediaType: "audio" },
    "audio/ogg": { extension: "ogg", mediaType: "audio" },
    "audio/mpeg": { extension: "mp3", mediaType: "audio" },
    "audio/wav": { extension: "wav", mediaType: "audio" },
    "image/jpeg": { extension: "jpg", mediaType: "photo" },
    "image/png": { extension: "png", mediaType: "photo" },
    "image/webp": { extension: "webp", mediaType: "photo" },
    "video/mp4": { extension: "mp4", mediaType: "video" },
    "video/webm": { extension: "webm", mediaType: "video" },
  };
  const mediaTypeInfo = extensions[contentType];
  if (!mediaTypeInfo || mediaTypeInfo.mediaType !== mediaType) {
    throw new Error("This media format is not supported for KEURAOKE Socials.");
  }
  if (!(await matchesMediaSignature(media, contentType))) {
    throw new Error("The file contents do not match the selected media type.");
  }
  const recordingPath = `${user.id}/${postId}.${mediaTypeInfo.extension}`;
  const { error: uploadError } = await client.storage
    .from("social-recordings")
    .upload(recordingPath, media, {
      contentType,
      upsert: false,
    });
  if (uploadError) {
    const detail = uploadError.message.toLowerCase().includes("size")
      ? "This recording is too large to post. Keep it under 50 MB."
      : "Your performance recording could not be uploaded. Check your connection and try again.";
    throw new Error(detail);
  }

  const { error: postError } = await client.from("social_posts").insert({
    id: postId,
    auth_user_id: user.id,
    song_title: details.songTitle,
    artist: details.artist,
    caption: details.caption,
    recording_path: recordingPath,
    media_type: mediaType,
  });
  if (postError) {
    const { error: cleanupError } = await client.storage
      .from("social-recordings")
      .remove([recordingPath]);
    if (cleanupError) console.error("An unused performance recording could not be removed.", cleanupError);
    throw new Error("Your post could not be saved. Check your connection and try again.");
  }
}

export async function updateAuthenticatedSocialCaption(postId: string, caption: string) {
  const client = requireClient();
  const user = await requireUser(client);
  const { data, error } = await client.from("social_posts")
    .update({ caption })
    .eq("id", postId)
    .eq("auth_user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    throw new Error("The post caption could not be updated. Check your connection and try again.");
  }
}

export async function deleteAuthenticatedSocialPost(postId: string) {
  const client = requireClient();
  const user = await requireUser(client);
  const { data: post, error: lookupError } = await client.from("social_posts")
    .select("recording_path")
    .eq("id", postId)
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (lookupError || !post) {
    throw new Error("This post could not be found or is not yours to delete.");
  }

  const { data: deletedPost, error: deleteError } = await client.from("social_posts")
    .delete()
    .eq("id", postId)
    .eq("auth_user_id", user.id)
    .select("id")
    .maybeSingle();
  if (deleteError || !deletedPost) {
    throw new Error("The post could not be deleted. Check your connection and try again.");
  }

  const { error: storageError } = await client.storage
    .from("social-recordings")
    .remove([post.recording_path]);
  if (storageError) {
    throw new Error("The post was deleted, but its private media could not be cleaned up.");
  }
}

export async function reportAuthenticatedSocialPost(
  postId: string,
  reason: SocialPostReportReason,
  details: string,
) {
  const client = requireClient();
  const user = await requireUser(client);
  const { error } = await client.from("social_post_reports").insert({
    post_id: postId,
    reporter_id: user.id,
    reason,
    details: details.trim(),
  });
  if (error?.code === "23505") {
    throw new Error("You have already reported this post.");
  }
  if (error) {
    throw new Error("This post could not be reported. Check your connection and try again.");
  }
}

export async function toggleProfileFollow(userId: string, followed: boolean) {
  const client = requireClient();
  const user = await requireUser(client);
  if (user.id === userId) throw new Error("You cannot follow your own profile.");
  const result = followed
    ? await client.from("profile_follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", userId)
    : await client.from("profile_follows")
        .insert({ follower_id: user.id, following_id: userId });
  if (result.error) {
    throw new Error("Your follow could not be saved. Sign in again or check your connection.");
  }
}

export async function loadArtistProfile(userId: string): Promise<ArtistProfile | null> {
  const client = requireClient();
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) {
    throw new Error("Sign in with Google to view community profiles.");
  }

  const [profileResult, followerResult, followingResult, myFollowResult] = await Promise.all([
    client.from("profiles")
      .select("auth_user_id,artist_name,avatar_url")
      .eq("auth_user_id", userId)
      .maybeSingle(),
    client.from("profile_follows")
      .select("follower_id", { count: "exact", head: true })
      .eq("following_id", userId),
    client.from("profile_follows")
      .select("following_id", { count: "exact", head: true })
      .eq("follower_id", userId),
    client.from("profile_follows")
      .select("following_id")
      .eq("follower_id", user.id)
      .eq("following_id", userId)
      .maybeSingle(),
  ]);
  if (
    profileResult.error ||
    followerResult.error ||
    followingResult.error ||
    myFollowResult.error
  ) {
    throw new Error("The artist profile could not be loaded. Check your connection and try again.");
  }
  if (!profileResult.data) return null;

  const avatarUrl = profileResult.data.avatar_url
    ? await signedUrlMap(client, "avatars", [profileResult.data.avatar_url])
    : new Map<string, string>();
  return {
    userId,
    artistName: profileResult.data.artist_name,
    avatarUrl: avatarUrl.get(profileResult.data.avatar_url ?? "") ?? "",
    followers: followerResult.count ?? 0,
    following: followingResult.count ?? 0,
    followedByMe: Boolean(myFollowResult.data),
  };
}

export async function toggleAuthenticatedPostLike(postId: string, wasLiked: boolean) {
  const client = requireClient();
  const user = await requireUser(client);
  const result = wasLiked
    ? await client.from("social_post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("auth_user_id", user.id)
    : await client.from("social_post_likes")
        .insert({ post_id: postId, auth_user_id: user.id });
  if (result.error) {
    throw new Error("Your like could not be saved. Sign in again or check your connection.");
  }
}

export async function addAuthenticatedSocialComment(postId: string, content: string) {
  const client = requireClient();
  const user = await requireUser(client);
  const { error } = await client.from("social_post_comments").insert({
    post_id: postId,
    auth_user_id: user.id,
    content,
  });
  if (error) {
    throw new Error("Your comment could not be saved. Sign in again or check your connection.");
  }
}
