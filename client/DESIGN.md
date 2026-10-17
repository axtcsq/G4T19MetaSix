# MetaFor design context

## Existing visual direction

MetaFor uses a calm journal-like interface for personal mood reflection. Keep the current warm neutral surfaces, terracotta primary color, and restrained lavender accent. Use Crimson Text for editorial headings and Raleway for controls and body copy. Runtime color and type tokens live in `src/assets/css/main.css`; Nuxt UI components consume those tokens.

The Daily Mood screen keeps the form and journal history side by side on wide screens and stacked on narrow screens. Preserve this structure and the existing spacing when adding behavior. Use clear, conversational labels and keep mood choices visually distinct when selected.

## Interaction behavior

The daily reflection field is a ruled notebook: warm paper, subtle grain, a red margin, blue-gray ink, and a dark fountain-pen nib pointer with a native text fallback. Its Nuxt UI textarea remains the canonical input and grows with the reflection. Labels, history, and controls retain the app typography. `--font-journal` in `src/assets/css/main.css` owns the handwriting stack: self-hosted Biro Script, Segoe Print, Bradley Hand, then cursive. Biro Script is self-hosted from /fonts/biro-script/Biro_Script_reduced.ttf and copied into Vercel deployments by Vite. Its original license is retained alongside the font. The DaFont download is a reduced personal-use font; obtain the official webfont license before public production use. Paper decoration is intentionally light even in dark mode; forced-colors mode uses system field colors without texture.

Mood entries are stored by the server. Load the history on entry, show a loading state while it arrives, distinguish an empty history from a failed request, and offer retry after a load failure. Save only after server confirmation, prevent duplicate saves while the request is pending, and keep the selected mood and journal text if saving fails.

The frontend calls the relative `/api` path. Vite proxies that path to the local server during development; deployments should provide `VITE_API_BASE_URL` or route `/api` to the backend on the same origin.
