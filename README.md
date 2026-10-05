# KEU KARAOKE

KEU Karaoke is a mobile-first karaoke discovery and playback web app powered by YouTube.

Search for a song, choose a karaoke-focused result, and sing along using the official YouTube embedded player. KEU uses the official YouTube Data API for search and does not download, store, or re-host YouTube media.

Searches can be song titles or artist names; the server adds karaoke focus to the YouTube query. Up to 10 successful search terms are saved locally in the browser and can be cleared from the Recent Searches list.

Save individual results to My Karaoke to keep their video ID, title, channel, and thumbnail in browser local storage. Favorites are separate from Recent Searches and do not make additional YouTube API requests.

Add results to the local Up Next queue in order. Queue entries store only the video ID, title, channel, and thumbnail, and can be played in the official embedded player.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` in the project root.
3. Add your YouTube Data API v3 key:

   ```env
   YOUTUBE_API_KEY=your_youtube_api_key_here
   ```

   You can start from `.env.example`. Keep real keys private; `.env.local` is ignored by git.

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open the app at [http://localhost:3000](http://localhost:3000).

The API key is used only by the server-side `/api/search` route. Playback uses the official YouTube embedded player and remains subject to YouTube availability and embedding restrictions.

## Validation

```bash
npm run lint
npm run typecheck
npm run build
```
