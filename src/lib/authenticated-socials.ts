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

export type RemoteSocialPost = {
  post: SocialPost;
  recordingUrl: string;
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

export async function loadAuthenticatedSocialPosts(): Promise<RemoteSocialPost[]> {
  const client = requireClient();
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError) {
    throw new Error("Your sign-in session could not be verified. Sign in again or check your connection.");
  }
  if (!user) return [];

  const { data: postRows, error: postsError } = await client
    .from("social_posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (postsError) {
    throw new Error("The KEURAOKE Socials feed could not be loaded. Check your connection and try again.");
  }
  const posts: PostRow[] = postRows;
  if (posts.length === 0) return [];

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

  return posts.map((row) => {
    const author = profiles.get(row.auth_user_id);
    const avatar = author?.avatar_url ? avatarUrls.get(author.avatar_url) : null;
    return {
      post: {
        id: row.id,
        username: displayName(profiles, row.auth_user_id),
        avatar: avatar ?? "🎤",
        isRemote: true,
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
}

export async function createAuthenticatedSocialPost(
  details: Pick<SocialPost, "songTitle" | "artist" | "caption">,
  recording: Blob,
) {
  if (recording.size > 50 * 1024 * 1024) {
    throw new Error("This recording is too large to post. Keep it under 50 MB and try again.");
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
  const contentType = recording.type.split(";")[0] || "audio/webm";
  if (!["audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg"].includes(contentType)) {
    throw new Error("This browser recording format is not supported for Socials.");
  }
  const extension = contentType === "audio/mp4"
    ? "m4a"
    : contentType === "audio/ogg" ? "ogg" : contentType === "audio/mpeg" ? "mp3" : "webm";
  const recordingPath = `${user.id}/${postId}.${extension}`;
  const { error: uploadError } = await client.storage
    .from("social-recordings")
    .upload(recordingPath, recording, {
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
  });
  if (postError) {
    const { error: cleanupError } = await client.storage
      .from("social-recordings")
      .remove([recordingPath]);
    if (cleanupError) console.error("An unused performance recording could not be removed.", cleanupError);
    throw new Error("Your post could not be saved. Check your connection and try again.");
  }
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
