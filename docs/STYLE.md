# MetaFor style guide

The shared visual rules for every MetaFor page, so new work looks like it
belongs to the same app. Feature-specific notes (the dashboard garden, the
journal, the listening room) stay in `DESIGN.md`.

The real values live in code. Use these and don't copy their hex codes:

- `client/src/assets/css/main.css`: fonts, brand colours, light and dark theme tokens, the `.glass-action` button
- `client/app.config.ts`: Nuxt UI colours (`primary: 'brand'`)

If you need a value that isn't here, add it to `main.css` (and to this file)
rather than hard-coding it in one page.

## Feel

Calm, warm and personal, like a journal. Every page uses the Personality
pages' palette: white cards with warm brown borders, peach wells and
plum-grey muted text, with warm dark cards in dark mode. Terracotta is the main
colour. Lots of space, soft
shadows, rounded corners. One thing on a page can be playful (the cassette, the
garden, the turntable, the banner video); everything around it stays quiet.

## Colour

Always use the theme tokens, so the page works in light and dark mode for free.

| Token | Use for | Light | Dark |
| --- | --- | --- | --- |
| `--ui-bg` | Page background | `#faf8f6` | `#171b27` |
| `--ui-bg-elevated` | Cards, panels, dialogs | `#ffffff` | `#25222b` (warm dark) |
| `--ui-bg-accented` | Hover rows, chips, wells, result boxes | `#ffe6d2` (peach) | `#3a2a30` |
| `--ui-text` | Headings and main text | `#292321` | `#f5f1ee` |
| `--ui-text-muted` | Descriptions, captions, labels | `#665f78` | `#b9aec4` |
| `--ui-border` | Card borders, dividers | brown at 20% | peach at 18% |
| `--ui-primary` | Buttons, links, active states | brand-500 | brand-400 |

Brand scale: `--color-brand-50` to `--color-brand-950` (terracotta, 500 is
`#cd6651`). For accent text on a light background use brand-700 or darker so
it passes contrast. Extras: `--color-peach` (`#ffd3ac`, glows and highlights),
`--color-lavender` (`#998ba1`, secondary accent), `--color-brown` (`#7d4737`).

Rules:

- Never set a text or background colour without checking it in dark mode.
- Mixing a token with transparency is fine: `color-mix(in srgb, var(--ui-primary) 18%, transparent)`.
- A feature can define its own semantic tokens on its root class (like `.dashboard` or `.listening-room`), but point them at the shared tokens above so they follow the palette and dark mode.
- Mood colours, album colours and the garden are data, not theme, so they may use their own colours.

Mood colours: the five journal moods have full scales in `main.css`
(`--color-mood-sad-50` to `--color-mood-sad-950`, and the same for `happy`,
`relaxed`, `anxious` and `angry`; 500 is the Daily Mood picker's colour). They're
registered as Nuxt UI colours in `client/vite.config.js`, so
`<UBadge color="sad">` works. For a song's mood, use
`<MoodTag :track-id="track.id" />` (`components/mood/MoodTag.vue`) wherever a
song is shown: it fetches the mood, batches every tag on the page into one
request, and colours it by the journal mood it counts towards. Songs nobody has played yet (search results) get their sound mood worked out on the spot, showing "Analysing…" for a second or two. For mood text
on a light background use the 800 shade (200 in dark mode); the 500 shades of
Happy and Relaxed don't pass contrast.

## Typography

Two families, each with a clear job:

| Family | Token | Use for |
| --- | --- | --- |
| Raleway | `--font-sans` | All headings, buttons, labels, navigation, numbers in UI, eyebrows |
| Crimson Text | `--font-serif` | Body prose, descriptions, song and artist names, quotes |
| Biro Script | `--font-journal` | Only the Daily Mood journal text |

Don't use fake bold or fake italic: Raleway is loaded at 400 to 800 upright,
Crimson Text at 400, 600 and 700 upright plus 400 italic (for quotes). Add the
weight to the Google Fonts import first if you really need another.

### Type scale

This is the team's Figma type scale. Each style has a class and a size
variable in `main.css`. Use the class in templates, or the variable when a
page's CSS sets the size itself:

| Style | Font and weight | Size | Class | Variable | Example |
| --- | --- | --- | --- | --- | --- |
| Title (H1) | Raleway ExtraBold 800 | 48px | `.display-title` | `--text-title` | "Hi, Sam!", a quiz result, landing headings |
| Header (H2) | Raleway Bold 700 | 32px | `.page-title`, `.section-title` | `--text-header` | Page names like "Mood Calendar", main sections |
| Sub-header | Raleway SemiBold 600 | 24px | `.sub-header` | `--text-subheader` | "Choose your emotions", card and panel titles |
| Body | Crimson Text Regular 400 | 20px | `.body-text` | `--text-body` | Intros, descriptions, journal entries |
| Emphasis | Crimson Text SemiBold 600 | 20px | `.emphasis` | `--text-body` | "Calm, with a touch of nostalgic" |
| Quote | Crimson Text Italic 400 | 24px | `.quote` | `--text-quote` | Lead lines like "Your mood is a playlist on shuffle." |

Page names use the Header style (32px), so the 48px Title stays for big
moments. Small UI text the scale doesn't cover (buttons, captions, counts,
timestamps) stays at `0.75rem` to `0.9rem` in Raleway. Don't go below
`0.75rem` for anything people need to read.

```vue
<h1 class="page-title">Mood Calendar</h1>
<p class="body-text">Track your daily moods and the songs that soundtracked them.</p>
<h2 class="sub-header">Choose your emotions</h2>
```

The title sizes already shrink a little on small screens, so don't add mobile
font sizes for them. The classes take the page's text colour, and a page's own
styles can still change their margin or colour.

## Layout

- **Page width:** content sits in a centred shell, `width: var(--page-width); margin-inline: auto;`. `--page-width` is 1180px at most, with a `--page-gutter` on each side: 32px on desktop, 24px at 768px and below, 16px at 400px and below. The nav and footer use the same width, so every page lines up with them. Don't add your own mobile widths or side padding; the gutter already shrinks. Form and reading pages (Profile, a quiz result) can use a narrower centred column. Space the top of the page with `--page-top` (under the nav) and the bottom with `--page-bottom` (above the footer), not your own padding.
- **Page padding:** top `clamp(36px, 6vw, 72px)`, bottom `64px`.
- **Page header:** left-aligned `h1` with `.page-title`, then one or two lines of muted serif intro. No eyebrow above the page title.
- **Breakpoints:** use only these, as `max-width` queries:
  - `1000px`: tablet, wide grids drop to two columns or one
  - `768px`: small tablet and large phone, side-by-side layouts stack
  - `600px`: phone, smaller padding and single columns
  - `400px`: only for small tweaks on very narrow phones
- **Spacing:** multiples of 4px. Common values are 8, 12, 16, 20, 24, 32, 40, 56 and 72px. Use gaps between related items, and 56 to 80px between page sections.
- **No horizontal scroll** at 375px wide. Check every page at phone width.

## Components

### Main action button: `.glass-action`

The glossy terracotta pill is the main call to action ("Get Started", "Save",
"Connect Spotify"). Use one per view, or one per card at most. It already
handles hover, disabled and focus. Put it on a `UButton`, `RouterLink`, `<a>`
or `<button>`:

```vue
<UButton class="glass-action" label="Save mood" />
<RouterLink class="glass-action" to="/login">Get Started</RouterLink>
```

Use the same shared action family throughout the app:

- `glass-action`: terracotta primary actions.
- `glass-secondary`: neutral glossy pills, with dark-aware surfaces.
- `glass-icon`: circular 44px controls; every icon-only action needs an accessible label.
- `glass-text`: quiet inline actions with the same UI font and focus treatment.

Nuxt UI solid buttons map to primary; outline/soft/subtle map to secondary; ghost/link map to text. `app.config.ts` owns these mappings and is passed into the Nuxt UI plugin in `vite.config.js`. Use the same styles on native buttons and action links. Calendar days, quiz answer cards, switches, swatches and drag handles retain their task-specific shapes. Animated mood faces stay exclusive to journal mood choices.

### Cards

```css
.card {
  padding: 24px;            /* 20px on phones */
  border: 1px solid var(--ui-border);
  border-radius: 16px;
  background: var(--ui-bg-elevated);
  box-shadow: 0 6px 18px rgba(125, 71, 55, 0.08);
}
.card:hover {               /* only if the card is clickable */
  transform: translateY(-3px);
  box-shadow: 0 10px 24px rgba(125, 71, 55, 0.14);
}
```

Shadows are always warm brown (`rgba(125, 71, 55, …)`), never grey or black.

### Radius

| Size | Use for |
| --- | --- |
| `8px` to `10px` | Inputs, small buttons, chips, list rows |
| `16px` to `18px` | Cards, panels, banners, dialogs |
| `999px` | Pills and the `.glass-action` button |
| `50%` | Avatars, icons, number circles |

### Icons

Icons are small inline SVGs with `stroke="currentColor"` or `fill="currentColor"`,
so they take the text colour and work in both modes. Keep them `1rem` to
`1.25rem` beside text, and add `aria-hidden="true"` when a label is next to
them.

## Motion

- Hovers and small state changes: `140ms` to `200ms ease`. Bigger panels can take up to `300ms`.
- Lifts are small: `translateY(-1px)` for buttons, `-3px` for cards.
- Every animation, canvas or video must respect `prefers-reduced-motion: reduce`: stop it or show a still frame.
- Pause canvas and WebGL work when the element is offscreen or the tab is hidden.

## Dark mode

- The `.dark` class on `<html>` switches the tokens. Using tokens means most things just work.
- In a scoped `<style>`, write dark-only rules as `:global(.dark .my-page .thing)`. `:global(.dark) .thing` compiles to just `.dark` and breaks.
- Test every change in both modes before pushing.

## Accessibility

- Tap targets are at least 44px tall (the `.glass-action` button already is).
- Keep the visible focus ring: `outline: 3px solid rgba(205, 102, 81, 0.35); outline-offset: 3px;`.
- Text contrast is at least 4.5:1. Muted text on `--ui-bg-accented` is the usual one to check.
- Decorative images and videos get `alt=""` or `aria-hidden="true"`. Meaningful ones get real alt text.

## Before you push UI changes

- [ ] Colours and fonts come from tokens, with no new hard-coded hex values for theme colours
- [ ] Sizes come from the type scale above
- [ ] Looks right in light and dark mode
- [ ] Works at 375px wide with no sideways scroll
- [ ] Reduced motion is respected
- [ ] Buttons and links have hover and focus states

## Allowed exceptions

These keep their own colours on purpose, in both modes:

- The journal paper on Daily Mood and the drawing paper on Canvas.
- Mood colours, the drawing palette, album-cover colours and the dashboard garden. These are data, not theme.
- The glossy white pills (mood choices, canvas tools), which are a component style like `.glass-action`.
- The garden on Home draws its own sky.
- The landing page's typed "What's MetaFor?" title (Crimson Text) and the banner's "The Real You?" are larger display headings, from the Figma and by request.
