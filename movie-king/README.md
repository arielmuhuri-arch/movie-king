# Movie King

Browse trending, popular, top rated and upcoming movies from TMDB, search by title, play trailers inside the details modal, and see where each movie streams.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env.local` file with your TMDB read access token (API Settings -> API Access -> **API Read Access Token**):

   ```bash
   VITE_TMDB_ACCESS_TOKEN=eyJhbGciOi...
   ```

   Note: this is the read access token, not the v3 API key.

3. Start the dev server:

   ```bash
   npm run dev
   ```

## Commands

- `npm run dev` - start the Vite dev server
- `npm run build` - build for production
- `npm run preview` - preview the production build
- `npm run lint` - run ESLint

## Notes

- Requests use `Authorization: Bearer <token>` on the TMDB v3 API.
- Trailers come from `/movie/{id}/videos` and are embedded from YouTube only after the user presses play, so no third-party player loads until then.
- Streaming options come from `/movie/{id}/watch/providers` and link out to the official provider (Netflix, Prime Video, Disney+, Apple TV, free/ad-supported platforms). This app does not host or proxy any video files.
- The provider data is JustWatch-powered via TMDB and **requires JustWatch attribution**, which the UI displays. Keep that line if you keep the section, or TMDB can revoke API access.
- Provider data is region-scoped; change `WATCH_REGION` in `src/App.jsx` to match your country.

## Licensing

- TMDB is free for non-commercial use with attribution. Monetizing the app, adding ads, or charging users requires a commercial license.
- Every image on this site comes from TMDB and must satisfy [TMDB's image guidelines](https://developer.themoviedb.org/docs/image-basics). For proper attribution, add a "This product uses the TMDB API but is not endorsed or certified by TMDB" notice in your footer and a TMDB logo.
