# MetaFor design context

## Existing visual direction

MetaFor uses a calm journal-like interface for personal mood reflection. Keep the current warm neutral surfaces, terracotta primary color, and restrained lavender accent. Use Crimson Text for editorial headings and Raleway for controls and body copy. Runtime color and type tokens live in `src/assets/css/main.css`; Nuxt UI components consume those tokens.

The Daily Mood screen keeps the form and journal history side by side on wide screens and stacked on narrow screens. Preserve this structure and the existing spacing when adding behavior. Use clear, conversational labels and keep mood choices visually distinct when selected.

## Interaction behavior

### Listening dashboard

The dashboard is a portrait of real Spotify recent history. Preserve the existing Crimson Text/Raleway pair, compact open layout and p5 botanical garden. Raleway owns headings and controls; Crimson Text owns music names, prose and summary numerals. Shared tokens and scrollbars live in `src/assets/css/main.css`. Dashboard semantic colors belong to `.dashboard` in `src/views/dashboard.vue`: paper `#fff`, ground `#f4f1ee`, ink `#30352f`, muted `#655e56`, accent `#a54b3b`, rule `#e3ddd5`.

`useSpotifyHistory` owns dashboard authentication, loading, retry and disconnect without playback or search. `api/spotify.js` remains the shared authentication/request boundary. `useListeningRoom` belongs to the separate listening-room branch. Refresh and Disconnect sit beneath the weekly/monthly selector.

`spotifyDashboard.js` owns period filtering and aggregation of up to 50 returned plays. All rankings and charts describe only that history; first appearances do not prove new discoveries. Artist collaborations count for each credited artist, but once in total plays. Show counts, not estimated listening minutes. Numeric ranking counts have no per-row units or Play buttons; artist, track and Spotify attribution links remain.

`artworkModel.js` maps the top five artists to deterministically selected visual flower styles. Presets are named for their appearance, never for artists or inferred emotions. Flower size reflects recorded play counts; leaves are decorative. Summary totals use prominent responsive serif numerals with restrained labels.

`ListeningArtwork.vue` lazy-loads p5 in instance mode on a 1000 by 650 canvas. It uses p5 2.x point-wise cubic Bézier vertices. Pause/Animate is the sole garden action. Stop animation when paused, offscreen, hidden or reduced motion is requested; remove observers, listeners and the p5 instance on unmount. Loading and retry reserve the canvas geometry. The artist color key remains beneath the garden.

`ListeningChart.vue` renders actual hourly, daily and repeat-play counts. Mood over time, Emotion profile and Genre mix remain visible but explicitly unavailable until real measurements exist. Never substitute sample values or use the unscoped mood-log collection as personal data. Preserve the two-column desktop grid and stacked mobile layout. The user removed the coverage paragraph, journal shortcut, artwork-rights paragraph and hourly/daily/repeat footnotes.

Live Singapore weather appears inside the garden automatically. `useGardenWeather` owns refresh and cancellation; `gardenWeather.js` draws atmosphere with the garden's paused/reduced-motion clock. No weather readout, location controls, previews or export appear on this dashboard. Provider details and verification live in WEATHER.md.

### Daily mood journal

The daily reflection field is a ruled notebook: warm paper, subtle grain, a red margin, blue-gray ink, and a dark fountain-pen nib pointer with a native text fallback. Its Nuxt UI textarea remains the canonical input and grows with the reflection. Labels, history, and controls retain the app typography. `--font-journal` in `src/assets/css/main.css` owns the handwriting stack: locally installed Biro Script, Segoe Print, Bradley Hand, then cursive. Biro Script's downloaded desktop EULA does not grant web redistribution; obtain an appropriate webfont license before bundling a font file. The reference EULA is retained at `../.font-reference/License_EULA.rtf`. Paper decoration is intentionally light even in dark mode; forced-colors mode uses system field colors without texture.

Mood entries are stored by the server. Load the history on entry, show a loading state while it arrives, distinguish an empty history from a failed request, and offer retry after a load failure. Save only after server confirmation, prevent duplicate saves while the request is pending, and keep the selected mood and journal text if saving fails.

The frontend calls the relative `/api` path. Vite proxies that path to the local server during development; deployments should provide `VITE_API_BASE_URL` or route `/api` to the backend on the same origin.
