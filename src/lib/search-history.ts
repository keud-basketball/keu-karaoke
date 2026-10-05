const STORAGE_KEY = "keu-karaoke-recent-searches";
const HISTORY_UPDATED_EVENT = "keu-karaoke:search-history-updated";
const MAX_SEARCHES = 10;

export function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const stored: unknown = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? "[]",
    );
    if (!Array.isArray(stored)) return [];

    const searches: string[] = [];
    const seen = new Set<string>();
    for (const entry of stored) {
      if (typeof entry !== "string") continue;
      const query = entry.trim();
      const normalized = query.toLowerCase();
      if (!query || seen.has(normalized)) continue;
      seen.add(normalized);
      searches.push(query);
      if (searches.length === MAX_SEARCHES) break;
    }
    return searches;
  } catch {
    return [];
  }
}

export function saveRecentSearch(query: string): void {
  const normalizedQuery = query.trim();
  if (typeof window === "undefined" || !normalizedQuery) return;

  try {
    const searches = getRecentSearches().filter(
      (entry) => entry.toLowerCase() !== normalizedQuery.toLowerCase(),
    );
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([normalizedQuery, ...searches].slice(0, MAX_SEARCHES)),
    );
    window.dispatchEvent(new Event(HISTORY_UPDATED_EVENT));
  } catch {
    // Storage can be unavailable in private browsing or restricted contexts.
  }
}

export function clearRecentSearches(): boolean {
  if (typeof window === "undefined") return false;

  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(HISTORY_UPDATED_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function subscribeToRecentSearches(onUpdate: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  window.addEventListener(HISTORY_UPDATED_EVENT, onUpdate);
  return () => window.removeEventListener(HISTORY_UPDATED_EVENT, onUpdate);
}
