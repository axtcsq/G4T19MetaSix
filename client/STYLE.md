# MetaFor style guide

The shared visual rules for every MetaFor page, so new work looks like it
belongs to the same app. Feature-specific notes (the dashboard garden, the
journal, the listening room) stay in `DESIGN.md`.

The real values live in code. Use these and don't copy their hex codes:

- `src/assets/css/main.css`: fonts, brand colours, light and dark theme tokens, the `.glass-action` button
- `app.config.ts`: Nuxt UI colours (`primary: 'brand'`)

If you need a value that isn't here, add it to `main.css` (and to this file)
rather than hard-coding it in one page.

## Feel

Calm, warm and personal, like a journal. Warm neutral surfaces, terracotta as
the main colour, peach and lavender as quiet accents. Lots of space, soft
shadows, rounded corners. One thing on a page can be playful (the cassette, the
garden, the turntable, the banner video); everything around it stays quiet.

## Colour

Always use the theme tokens, so the page works in light and dark mode for free.

| Token | Use for | Light | Dark |
| --- | --- | --- | --- |
| `--ui-bg` | Page background | `#faf8f6` | `#171b27` |
| `--ui-bg-elevated` | Cards, panels, dialogs | `#ffffff` | `#222839` |
| `--ui-bg-accented` | Hover rows, chips, wells | `#f1e9e5` | `#30384a` |
| `--ui-text` | Headings and main text | `#292321` | `#f5f1ee` |
| `--ui-text-muted` | Descriptions, captions, labels | `#756c68` | `#a9a5b0` |
| `--ui-border` | Card borders, dividers | `#e7dcd7` | `#343b4b` |
| `--ui-primary` | Buttons, links, active states | brand-500 | brand-400 |

Brand scale: `--color-brand-50` to `--color-brand-950` (terracotta, 500 is
`#cd6651`). For accent text on a light background use brand-700 or darker so
it passes contrast. Extras: `--color-peach` (`#ffd3ac`, glows and highlights),
`--color-lavender` (`#998ba1`, secondary accent), `--color-brown` (`#7d4737`).

Rules:

- Never set a text or background colour without checking it in dark mode.
- Mixing a token with transparency is fine: `color-mix(in srgb, var(--ui-primary) 18%, transparent)`.
- A feature can define its own semantic tokens on its root class (like `.dashboard` or `.listening-room`), but keep them in the warm palette and document them in `DESIGN.md`.
- Mood colours, album colours and the garden are data, not theme, so they may use their own colours.

## Typography

Two families, each with a clear job:

| Family | Token | Use for |
| --- | --- | --- |
| Raleway | `--font-sans` | All headings, buttons, labels, navigation, numbers in UI, eyebrows |
| Crimson Text | `--font-serif` | Body prose, descriptions, song and artist names, quotes |
| Biro Script | `--font-journal` | Only the Daily Mood journal text |

`main.css` already sets `h1` to `h6` to Raleway 700 with `-0.025em` letter
spacing. Don't use fake bold or fake italic: Raleway is loaded at 400 to 800
upright, Crimson Text at 400, 600 and 700 upright. Add the weight to the Google
Fonts import first if you really need another.

Type scale (use these sizes, rather than inventing new ones):

| Role | Size | Weight | Example |
| --- | --- | --- | --- |
| Display | `clamp(2.4rem, 7vw, 4.2rem)` | 800 | Landing banner, "The Real You?" |
| Page title (`h1`) | `clamp(2rem, 4vw, 2.8rem)` | 700 | "Mood Calendar", "Find Your Personality" |
| Section title (`h2`) | `clamp(1.5rem, 3vw, 2rem)` | 700 to 800 | "Your playlist is a mirror." |
| Card title (`h3`) | `1.1rem` to `1.25rem` | 700 | Quiz and feature card titles |
| Body (serif) | `1.05rem` to `1.25rem`, line-height 1.45 to 1.6 | 400 | Descriptions, intros |
| Small / caption | `0.85rem` to `0.9rem` | 500 to 600 | Hints, timestamps, notes |
| Eyebrow | `0.75rem` to `0.8rem`, uppercase, letter-spacing `0.13em` | 800 | "YOUR LISTENING, YOUR FEELINGS" |

Don't go below `0.75rem` for anything people need to read.

## Layout

- **Page width:** content sits in a centred shell, `width: min(1120px, calc(100% - 40px)); margin-inline: auto;`. Pages with a lot of data (the dashboard) can go up to 1240px.
- **Page padding:** top `clamp(36px, 6vw, 72px)`, bottom `64px`.
- **Page header:** centred eyebrow, then `h1`, then one or two lines of muted serif intro.
- **Breakpoints:** `600px` (phone: stack everything, smaller padding) and `1000px` (tablet: two-column grids become one). Use these two rather than new ones.
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

For secondary actions use a plain Nuxt UI `UButton` with `variant="outline"`,
`"soft"` or `"ghost"`. It picks up the brand colour from `app.config.ts`.

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

## Known differences to tidy up

These pages don't follow the guide yet. Fix them when you're next working on
that page:

- Page titles use different sizes (`2rem`, `clamp(1.6rem, 3vw, 2.1rem)`, `clamp(2rem, 5vw, 3.2rem)`). Move them to the page-title size above.
- Daily Mood's `h1` uses Crimson Text. Headings should be Raleway.
- `canvas.vue` and `daily-mood.vue` have many hard-coded colours. Swap the theme ones for tokens. The journal paper colours are fine.
- Breakpoints vary (`650px`, `680px`, `700px`, `750px`, `760px`, `860px`). Move them to `600px` and `1000px`.
