# MetaFor design context

## Existing visual direction

MetaFor uses a calm journal-like interface for personal mood reflection. Keep the current warm neutral surfaces, terracotta primary color, and restrained lavender accent. Use Crimson Text for editorial headings and Raleway for controls and body copy. Runtime color and type tokens live in `src/assets/css/main.css`; Nuxt UI components consume those tokens.

The Daily Mood screen keeps the form and journal history side by side on wide screens and stacked on narrow screens. Preserve this structure and the existing spacing when adding behavior. Use clear, conversational labels and keep mood choices visually distinct when selected.

## Interaction behavior

Mood entries are stored by the server. Load the history on entry, show a loading state while it arrives, distinguish an empty history from a failed request, and offer retry after a load failure. Save only after server confirmation, prevent duplicate saves while the request is pending, and keep the selected mood and journal text if saving fails.

The frontend calls the relative `/api` path. Vite proxies that path to the local server during development; deployments should provide `VITE_API_BASE_URL` or route `/api` to the backend on the same origin.
