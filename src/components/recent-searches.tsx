"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SEARCH_AGAIN_EVENT } from "@/lib/search-types";
import {
  clearRecentSearches,
  getRecentSearches,
  subscribeToRecentSearches,
} from "@/lib/search-history";

export function RecentSearches() {
  const router = useRouter();
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    const updateSearches = () => setRecentSearches(getRecentSearches());
    updateSearches();
    return subscribeToRecentSearches(updateSearches);
  }, []);

  function searchRecentQuery(query: string) {
    const currentUrl = new URL(window.location.href);
    if (
      currentUrl.pathname === "/" &&
      currentUrl.searchParams.get("q")?.trim() === query.trim()
    ) {
      window.dispatchEvent(new Event(SEARCH_AGAIN_EVENT));
      return;
    }
    router.push(`/?q=${encodeURIComponent(query)}`);
  }

  function clearSearchHistory() {
    if (clearRecentSearches()) setRecentSearches([]);
  }

  return (
    <section className="recent-searches history-list" aria-labelledby="recent-searches-heading">
      <div className="recent-searches-heading">
        <h2 id="recent-searches-heading">Recent Searches</h2>
        {recentSearches.length > 0 && (
          <button className="recent-searches-clear" onClick={clearSearchHistory} type="button">
            Clear History
          </button>
        )}
      </div>
      {recentSearches.length > 0 ? (
        <div className="recent-searches-list">
          {recentSearches.map((query) => (
            <button
              className="recent-search-chip"
              key={query.toLowerCase()}
              onClick={() => searchRecentQuery(query)}
              title={query}
              type="button"
            >
              {query}
            </button>
          ))}
        </div>
      ) : (
        <p className="favorites-empty">Your recent searches will appear here.</p>
      )}
    </section>
  );
}
