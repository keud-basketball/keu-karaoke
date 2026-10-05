"use client";

import { useState } from "react";

type SearchFormProps = {
  initialQuery?: string;
  compact?: boolean;
};

export function SearchForm({
  initialQuery = "",
  compact = false,
}: SearchFormProps) {
  const [value, setValue] = useState(initialQuery);

  return (
    <>
      <form className={`search-form${compact ? " search-form-compact" : ""}`} action="/">
        <label className="sr-only" htmlFor={compact ? "results-query" : "home-query"}>
          Search for a song to sing
        </label>
        <span className="search-icon" aria-hidden="true">⌕</span>
        <input
          autoComplete="off"
          id={compact ? "results-query" : "home-query"}
          maxLength={150}
          name="q"
          onChange={(event) => setValue(event.target.value)}
          placeholder="Search for a song to sing..."
          required
          type="search"
          value={value}
        />
        <button className="button button-primary search-submit" type="submit">
          SEARCH
        </button>
      </form>
    </>
  );
}
