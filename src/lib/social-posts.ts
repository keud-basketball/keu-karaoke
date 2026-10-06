export type SocialComment = {
  id: string;
  username: string;
  text: string;
  createdAt: string;
};

export type SocialPost = {
  id: string;
  authorId?: string;
  username: string;
  avatar: string;
  isRemote?: boolean;
  mediaType?: "audio" | "photo" | "video";
  songTitle: string;
  artist: string;
  caption: string;
  createdAt: string;
  likes: number;
  likedByMe: boolean;
  comments: SocialComment[];
};

const POSTS_KEY = "keuraoke:social-posts";
const DATABASE_NAME = "keuraoke-socials";
const RECORDINGS_STORE = "recordings";

function isSocialComment(value: unknown): value is SocialComment {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      typeof value.id === "string" &&
      "username" in value &&
      typeof value.username === "string" &&
      "text" in value &&
      typeof value.text === "string" &&
      "createdAt" in value &&
      typeof value.createdAt === "string",
  );
}

function isSocialPost(value: unknown): value is SocialPost {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      typeof value.id === "string" &&
      "username" in value &&
      typeof value.username === "string" &&
      "avatar" in value &&
      typeof value.avatar === "string" &&
      "songTitle" in value &&
      typeof value.songTitle === "string" &&
      "artist" in value &&
      typeof value.artist === "string" &&
      "caption" in value &&
      typeof value.caption === "string" &&
      "createdAt" in value &&
      typeof value.createdAt === "string" &&
      "likes" in value &&
      typeof value.likes === "number" &&
      "likedByMe" in value &&
      typeof value.likedByMe === "boolean" &&
      "comments" in value &&
      Array.isArray(value.comments) &&
      value.comments.every(isSocialComment),
  );
}

function readPosts(): SocialPost[] {
  const stored = window.localStorage.getItem(POSTS_KEY);
  if (!stored) return [];

  let value: unknown;
  try {
    value = JSON.parse(stored);
  } catch (error: unknown) {
    throw new Error("Saved Socials posts could not be read.", { cause: error });
  }
  if (!Array.isArray(value) || !value.every(isSocialPost)) {
    throw new Error("Saved Socials posts have an invalid format.");
  }
  return value;
}

function writePosts(posts: SocialPost[]) {
  window.localStorage.setItem(POSTS_KEY, JSON.stringify(posts));
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(RECORDINGS_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Socials storage could not be opened."));
    request.onblocked = () => reject(new Error("Socials storage is blocked by another open tab."));
  });
}

function saveRecording(postId: string, recording: Blob): Promise<void> {
  return openDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction(RECORDINGS_STORE, "readwrite");
    transaction.objectStore(RECORDINGS_STORE).put(recording, postId);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("The performance recording could not be saved."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("The performance recording could not be saved."));
    };
  }));
}

export async function loadSocialPosts(): Promise<SocialPost[]> {
  return readPosts().sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function loadSocialRecording(postId: string): Promise<Blob | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(RECORDINGS_STORE, "readonly");
    const request = transaction.objectStore(RECORDINGS_STORE).get(postId);
    request.onsuccess = () => {
      database.close();
      resolve(request.result instanceof Blob ? request.result : null);
    };
    request.onerror = () => {
      database.close();
      reject(request.error ?? new Error("The performance recording could not be loaded."));
    };
  });
}

export async function createSocialPost(
  postDetails: Pick<SocialPost, "songTitle" | "artist" | "caption">,
  recording: Blob,
): Promise<void> {
  const post: SocialPost = {
    ...postDetails,
    id: crypto.randomUUID(),
    username: "KEURAOKE Singer",
    avatar: "🎤",
    createdAt: new Date().toISOString(),
    likes: 0,
    likedByMe: false,
    comments: [],
  };

  await saveRecording(post.id, recording);
  writePosts([post, ...readPosts()]);
}

function updateSocialPost(postId: string, update: (post: SocialPost) => SocialPost) {
  const posts = readPosts();
  const postIndex = posts.findIndex((post) => post.id === postId);
  if (postIndex === -1) throw new Error("This Socials post is no longer available.");
  const updatedPosts = [...posts];
  updatedPosts[postIndex] = update(posts[postIndex]);
  writePosts(updatedPosts);
  return updatedPosts[postIndex];
}

export function toggleSocialPostLike(postId: string): SocialPost {
  return updateSocialPost(postId, (post) => ({
    ...post,
    likes: post.likes + (post.likedByMe ? -1 : 1),
    likedByMe: !post.likedByMe,
  }));
}

export function addSocialComment(postId: string, text: string): SocialPost {
  const comment = {
    id: crypto.randomUUID(),
    username: "KEURAOKE Singer",
    text,
    createdAt: new Date().toISOString(),
  };
  return updateSocialPost(postId, (post) => ({
    ...post,
    comments: [...post.comments, comment],
  }));
}
