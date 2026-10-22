# MetaFor design context

## Existing visual direction

MetaFor uses a calm journal-like interface for personal mood reflection. Keep the current warm neutral surfaces, terracotta primary color, and restrained lavender accent. Use Crimson Text for editorial headings and Raleway for controls and body copy. Runtime color and type tokens live in `src/assets/css/main.css`; Nuxt UI components consume those tokens.

The Daily Mood screen keeps the form and journal history side by side on wide screens and stacked on narrow screens. Preserve this structure and the existing spacing when adding behavior. Use clear, conversational labels and keep mood choices visually distinct when selected.

## Interaction behavior

### Listening dashboard

The dashboard is a portrait of real Spotify recent history. Preserve the existing Crimson Text/Raleway pair, compact open layout and p5 botanical garden. Raleway owns headings and controls; Crimson Text owns music names, prose and summary numerals. Shared tokens and scrollbars live in `src/assets/css/main.css`. Dashboard semantic colors belong to `.dashboard` in `src/views/dashboard.vue`: paper `#fff`, ground `#f4f1ee`, ink `#30352f`, muted `#655e56`, accent `#a54b3b`, rule `#e3ddd5`.

`useSpotifyHistory` owns dashboard loading and retry without playback or search. Spotify access comes from the MetaFor login; `api/spotify.js` remains the shared token/request boundary. `useListeningRoom` belongs to the separate listening-room branch. Refresh sits beneath the weekly/monthly selector.

`spotifyDashboard.js` owns period filtering and aggregation of up to 50 returned plays. All rankings and charts describe only that history; first appearances do not prove new discoveries. Artist collaborations count for each credited artist, but once in total plays. Show counts, not estimated listening minutes. Numeric ranking counts have no per-row units or Play buttons; artist, track and Spotify attribution links remain.

`artworkModel.js` maps the top five artists to deterministically selected visual flower styles. Presets are named for their appearance, never for artists or inferred emotions. Flower size reflects recorded play counts; leaves are decorative. Summary totals use prominent responsive serif numerals with restrained labels.

`ListeningArtwork.vue` lazy-loads p5 in instance mode on a 1000 by 650 canvas. It uses p5 2.x point-wise cubic Bézier vertices. Pause/Animate is the sole garden action. Stop animation when paused, offscreen, hidden or reduced motion is requested; remove observers, listeners and the p5 instance on unmount. Loading and retry reserve the canvas geometry. The artist color key remains beneath the garden.

`ListeningChart.vue` renders actual hourly, daily and repeat-play counts. Mood over time, Emotion profile and Genre mix remain visible but explicitly unavailable until real measurements exist. Never substitute sample values or use the unscoped mood-log collection as personal data. Preserve the two-column desktop grid and stacked mobile layout. The user removed the coverage paragraph, journal shortcut, artwork-rights paragraph and hourly/daily/repeat footnotes.

Live Singapore weather appears inside the garden automatically. `useGardenWeather` owns refresh and cancellation; `gardenWeather.js` draws atmosphere with the garden's paused/reduced-motion clock. No weather readout, location controls, previews or export appear on this dashboard. Provider details and verification live in WEATHER.md.

### Daily mood journal

The daily reflection field is a ruled notebook: warm paper, subtle grain, a red margin, blue-gray ink, and a dark fountain-pen nib pointer with a native text fallback. Its Nuxt UI textarea remains the canonical input and grows with the reflection. Labels, history, and controls retain the app typography. `--font-journal` in `src/assets/css/main.css` owns the handwriting stack: locally installed Biro Script, Segoe Print, Bradley Hand, then cursive. Biro Script's downloaded desktop EULA does not grant web redistribution; obtain an appropriate webfont license before bundling a font file. The reference EULA is retained at `../.font-reference/License_EULA.rtf`. Paper decoration is intentionally light even in dark mode; forced-colors mode uses system field colors without texture.
The daily reflection field is a ruled notebook: warm paper, subtle grain, a red margin, blue-gray ink, and a dark fountain-pen nib pointer with a native text fallback. Its Nuxt UI textarea remains the canonical input and grows with the reflection. Labels, history, and controls retain the app typography. `--font-journal` in `src/assets/css/main.css` owns the handwriting stack: self-hosted Biro Script, Segoe Print, Bradley Hand, then cursive. Biro Script is self-hosted from /fonts/biro-script/Biro_Script_reduced.ttf and copied into Vercel deployments by Vite. Its original license is retained alongside the font. The DaFont download is a reduced personal-use font; obtain the official webfont license before public production use. Paper decoration is intentionally light even in dark mode; forced-colors mode uses system field colors without texture.

Mood entries are stored by the server. Load the history on entry, show a loading state while it arrives, distinguish an empty history from a failed request, and offer retry after a load failure. Save only after server confirmation, prevent duplicate saves while the request is pending, and keep the selected mood and journal text if saving fails.

The frontend calls the relative `/api` path. Vite proxies it to the local server during development; Vercel Services routes it to the server service on the same origin using the root `vercel.json` rewrite.


### Listening room

`/listen` is the active listening destination, linked beside Daily Mood; the dashboard remains a retrospective portrait. Preserve the established Crimson Text/Raleway families. The listening room's semantic surface tokens are owned by `.listening-room` in `src/views/listen.vue`: paper `#faf8f6`, ground `#f0eeea`, ink `#30352f`, muted `#655e56`, dark controls `#303a32`, and sage `#dce6dd`. Dynamic `--record-color` comes from the current album cover, lightened for contrast; the fallback is `#c9d0b5`. These are feature tokens, not a replacement of the shared brand palette.

MetaFor's song-as-feeling ritual becomes a physical record on a Three.js turntable. The turntable is the focal point; the sleeve, controls, and example record shelf remain quiet and functional. Keep the full album cover visible beside the scene. No new art direction was drawn for this application feature; it follows the existing design context and uses the requested taste skill's component guidance. Existing shared navigation keeps its brand accent.

`useListeningRoom` is the canonical playback owner for the room and shared `ListeningDock`. Spotify access comes from the MetaFor login, through short-lived tokens from the server. Playback persists across route changes and the dock provides pause/disconnect access outside the room. The disconnected state is explicitly a silent visual preview. Native buttons and range inputs own keyboard playback, seek and volume; the scene provides pointer shortcuts and optional view rotation. Disable unavailable operations while busy/offline, expose failures as inline alerts, honour reduced motion and provide a WebGL fallback. Search is IME-safe, cancellable and transient; the record shelf contains fixed example tracks, never personalised recommendations. See `SPOTIFY.md` for the auth/storage and HTTP contract.

Listening room refinement (October 2026): Raleway owns the page heading, track heading and controls; Crimson Text owns descriptive text, artist/album metadata and shelf titles. Keep the turntable on a transparent stage with no surrounding text, colored panel, sleeve tab or rotation/reset chrome. The album cover has an image-derived blurred glow and a soft gradient, explicitly requested by the user as an exception to design-taste defaults. Playback uses a compact bank of labeled Previous/Spin-or-Play/Next keys and native, styled seek/volume sliders; disabled sliders stay disabled without Spotify playback. The silent-preview notice sits beside the connection action. Remove mood filters, shelf introductory copy, journal promotion and developer setup disclosure. The shelf shows artwork and track names, with artist names retained for assistive technology. Spotify search appears only while connected; cancellation, IME safety, results, errors, reconnect and disconnect remain owned by useListeningRoom. Album credits remain linked in the footer.


Spotify live-data migration: `useListeningRoom` owns actual Spotify recent history and SDK playback. Disconnected screens show connection/empty states with disabled transport. Search is transient and cancellable; personal data clears on disconnect. Music and artwork link to Spotify.
