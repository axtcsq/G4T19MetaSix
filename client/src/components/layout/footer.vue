<script setup>
import ButterflyMark from './ButterflyMark.vue'
defineOptions({ name: 'SiteFooter' })

// The same pages as the navbar, grouped by what they're for.
const groups = [
  {
    title: 'Track',
    links: [
      { to: '/dashboard', label: 'Home' },
      { to: '/daily-mood', label: 'Daily Mood' },
      { to: '/calendar', label: 'Calendar' },
    ],
  },
  {
    title: 'Explore',
    links: [
      { to: '/listen', label: 'Listening Room' },
      { to: '/quiz', label: 'Personality' },
    ],
  },
]

const year = new Date().getFullYear()

function backToTop() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
}
</script>

<template>
  <footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-top">
        <div class="footer-brand">
          <RouterLink class="brand" to="/">
            <ButterflyMark class="brand-butterfly" :size="26" />
            <span>MetaFor</span>
          </RouterLink>
          <p class="tagline">Your music can be a window into how you feel.</p>
        </div>

        <nav class="footer-links" aria-label="Footer">
          <div v-for="group in groups" :key="group.title" class="link-group">
            <p class="group-title">{{ group.title }}</p>
            <ul>
              <li v-for="link in group.links" :key="link.to">
                <RouterLink :to="link.to">{{ link.label }}</RouterLink>
              </li>
            </ul>
          </div>
        </nav>
      </div>

      <div class="footer-bottom">
        <p>© {{ year }} MetaFor · Made by MetaSix</p>
        <button type="button" class="top-button" @click="backToTop">Back to top ↑</button>
      </div>
    </div>
  </footer>
</template>

<style scoped>
/* Room for the floating listening dock, so it never covers the footer text. */
.site-footer {
  --footer-bg: #f1ebe6;
  --footer-text: #2b2321;
  --footer-muted: #6f625d;
  --footer-line: rgba(43, 35, 33, 0.12);
  --footer-accent: #b9543f;
  padding-bottom: var(--dock-space, 0px);
  border-top: 1px solid var(--footer-line);
  color: var(--footer-text);
  background: var(--footer-bg);
  font-family: var(--font-sans);
  font-size: 0.9rem;
}

:global(.dark .site-footer) {
  --footer-bg: #11141d;
  --footer-text: #f4efea;
  --footer-muted: #a89e99;
  --footer-line: rgba(255, 255, 255, 0.1);
  --footer-accent: #eaa596;
}

.footer-inner {
  width: var(--page-width);
  margin-inline: auto;
}

.footer-top {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 2rem 4rem;
  padding-block: 2.5rem 2rem;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: inherit;
  font-family: var(--font-serif);
  font-size: 1.45rem;
  font-weight: 700;
  text-decoration: none;
}

.brand-butterfly {
  flex-shrink: 0;
  color: var(--footer-accent);
}

.tagline {
  max-width: 28ch;
  margin-top: 0.5rem;
  color: var(--footer-muted);
  font-family: var(--font-serif);
  font-size: 1rem;
  line-height: 1.4;
}

.footer-links {
  display: flex;
  gap: 3.5rem;
}

.group-title {
  margin-bottom: 0.6rem;
  color: var(--footer-muted);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.link-group ul {
  display: grid;
  gap: 0.45rem;
}

.link-group a,
.top-button {
  color: inherit;
  text-decoration: none;
  text-underline-offset: 4px;
}

.link-group a:hover,
.top-button:hover {
  color: var(--footer-accent);
  text-decoration: underline;
}

.link-group a.router-link-exact-active {
  color: var(--footer-accent);
}

.footer-bottom {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem 1.5rem;
  min-height: 56px;
  border-top: 1px solid var(--footer-line);
  color: var(--footer-muted);
  font-size: 0.8rem;
}

.top-button {
  padding: 0.5rem 0;
  border: 0;
  background: none;
  font: inherit;
  cursor: pointer;
}

.link-group a:focus-visible,
.brand:focus-visible,
.top-button:focus-visible {
  border-radius: 4px;
  outline: 3px solid var(--footer-accent);
  outline-offset: 3px;
}

@media (max-width: 768px) {
  .footer-inner {
    width: calc(100% - 36px);
  }

  .footer-top {
    flex-direction: column;
    padding-block: 2rem 1.5rem;
  }

  .footer-links {
    gap: 2.5rem;
  }
}
</style>
