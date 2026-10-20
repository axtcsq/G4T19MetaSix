<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
// Nuxt UI's colour mode, which sets the .dark class on <html> and remembers the choice.
import { useColorMode } from '#imports'
defineOptions({ name: 'SiteNavbar' })

const route = useRoute()
const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')

function toggleTheme() {
  colorMode.preference = isDark.value ? 'light' : 'dark'
}
const isLanding = computed(() => route.path === '/')
const isListeningPage = computed(() => ['/dashboard', '/listen'].includes(route.path))
</script>

<template>
  <header
    class="site-header"
    :class="{ 'site-header-landing': isLanding, 'site-header-dashboard': isListeningPage }"
  >
    <div class="header-inner">
      <div class="brand-group">
        <RouterLink class="brand" to="/" aria-label="MetaFor home">
          MetaFor<span class="brand-mark">®</span>
        </RouterLink>

        <button
          type="button"
          class="theme-toggle"
          :class="{ 'is-dark': isDark }"
          role="switch"
          :aria-checked="isDark"
          aria-label="Dark mode"
          @click="toggleTheme"
        >
          <span class="theme-thumb" aria-hidden="true" />
          <svg class="theme-icon theme-sun" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path
              d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
            />
          </svg>
          <svg class="theme-icon theme-moon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
          </svg>
        </button>
      </div>

      <nav v-if="isLanding" class="header-nav" aria-label="Main navigation">
        <RouterLink class="header-cta glass-action" to="/signup">Get started</RouterLink>
      </nav>

      <nav v-else class="header-nav" aria-label="Main navigation">
        <RouterLink class="header-link" to="/">Home</RouterLink>
        <RouterLink class="header-link" to="/dashboard">Dashboard</RouterLink>
        <RouterLink class="header-link" to="/daily-mood">Daily Mood</RouterLink>
        <RouterLink class="header-link" to="/listen">Listening room</RouterLink>
        <RouterLink class="header-link" to="/canvas">Canvas</RouterLink>
        <RouterLink class="header-link" to="/quiz">Personality</RouterLink>
        <RouterLink
          class="header-cta"
          :class="isListeningPage ? 'dashboard-signin' : 'glass-action'"
          to="/login"
          >Sign in</RouterLink
        >
      </nav>

      <!-- Outside the nav so it stays in the top row on phones, where the links scroll.
           Placeholder until the profile page exists; swap for a RouterLink then. -->
      <button
        type="button"
        class="profile-button"
        aria-label="Profile (coming soon)"
        title="Profile (coming soon)"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
      </button>
    </div>
  </header>
</template>

<style scoped>
.site-header {
  position: relative;
  z-index: 10;
  width: 100%;
  border-bottom: 1px solid #998ba155;
  background: #faf8f6;
}
.site-header-landing {
  background: #faf8f6;
}
.header-inner {
  display: flex;
  width: min(1180px, calc(100% - 64px));
  min-height: 76px;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-inline: auto;
}
.brand-group {
  display: flex;
  align-items: center;
  gap: 14px;
}
/* A small sun/moon switch; the thumb slides under the active icon. */
.theme-toggle {
  position: relative;
  display: inline-flex;
  width: 62px;
  height: 32px;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  padding: 0 7px;
  border: 1px solid #998ba155;
  border-radius: 999px;
  background: #f0eae6;
  cursor: pointer;
}
.theme-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: transform 200ms ease, background-color 200ms ease;
}
.theme-toggle.is-dark .theme-thumb {
  background: #2a2f3d;
  transform: translateX(30px);
}
.theme-icon {
  position: relative;
  width: 16px;
  height: 16px;
  fill: none;
  stroke: #9a918b;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: stroke 200ms ease;
}
.theme-toggle:not(.is-dark) .theme-sun {
  stroke: #cd6651;
}
.theme-toggle.is-dark .theme-moon {
  stroke: #ffcda6;
}
.theme-toggle:focus-visible {
  outline: 2px solid #cd6651;
  outline-offset: 3px;
}
@media (prefers-reduced-motion: reduce) {
  .theme-thumb,
  .theme-icon {
    transition: none;
  }
}
.brand {
  color: #000;
  font-family: var(--font-serif);
  font-size: 1.7rem;
  font-weight: 700;
  letter-spacing: -0.055em;
  text-decoration: none;
}
.brand-mark {
  display: inline-block;
  padding-left: 3px;
  font-family: var(--font-sans);
  font-size: 0.58rem;
  vertical-align: top;
}
.header-nav {
  display: flex;
  margin-left: auto;
  align-items: center;
  gap: clamp(15px, 3vw, 34px);
}
.header-link {
  color: #625a53;
  font-size: 0.94rem;
  font-weight: 600;
  text-decoration: none;
  transition: color 160ms ease;
}
.header-link:hover {
  color: #cd6651;
}
.header-link.router-link-exact-active {
  color: #a54b3b;
  text-decoration: underline;
  text-underline-offset: 7px;
}
.header-cta {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  gap: 11px;
  padding: 0 20px;
}
.profile-button {
  display: inline-flex;
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 1px solid #998ba155;
  border-radius: 50%;
  color: #625a53;
  background: #fff;
  cursor: pointer;
  transition: color 160ms ease, border-color 160ms ease;
}
.profile-button:hover {
  border-color: #cd6651;
  color: #cd6651;
}
.profile-button:focus-visible {
  outline: 2px solid #cd6651;
  outline-offset: 3px;
}
.profile-button svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.site-header-dashboard {
  border-bottom: 0;
}
.dashboard-signin {
  color: #fff;
  background: #a54b3b;
  border-radius: 999px;
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
}
.dashboard-signin:hover {
  background: #873c2f;
}
.dashboard-signin:focus-visible {
  outline: 2px solid #a54b3b;
  outline-offset: 4px;
}

@media (max-width: 600px) {
  .header-inner { width: calc(100% - 36px); min-height: 66px; }
  .brand { font-size: 1.48rem; }
  .header-nav { gap: 14px; }
  .header-cta { min-height: 42px; padding-inline: 17px; }
  .site-header:not(.site-header-landing) .header-link { font-size: 0.86rem; }

  /* The full link list doesn't fit beside the logo on phones, so it moves to its own row. */
  .site-header:not(.site-header-landing) .header-inner { flex-wrap: wrap; row-gap: 6px; padding-block: 10px; }
  .site-header:not(.site-header-landing) .header-nav { width: 100%; justify-content: space-between; gap: 6px; overflow-x: auto; scrollbar-width: none; }
  .site-header:not(.site-header-landing) .header-link { flex-shrink: 0; font-size: 0.8rem; }
  .site-header:not(.site-header-landing) .header-cta { flex-shrink: 0; min-height: 38px; }
  .header-inner { gap: 12px; }
  .brand-group { gap: 10px; }
  .profile-button { width: 38px; height: 38px; }

  /* Top row: brand and toggle on the left, profile on the right; links below. */
  .site-header:not(.site-header-landing) .profile-button { order: 1; margin-left: auto; }
  .site-header:not(.site-header-landing) .header-nav { order: 2; }
}
</style>
