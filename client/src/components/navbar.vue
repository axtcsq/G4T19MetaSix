<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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

const links = [
  { to: '/', label: 'Home' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/daily-mood', label: 'Daily Mood' },
  { to: '/listen', label: 'Listening room' },
  { to: '/canvas', label: 'Canvas' },
  { to: '/quiz', label: 'Personality' },
]

// The links fold into a menu as soon as they no longer fit on one row. The nav
// stays in the page (hidden) while folded, so its full width can still be measured.
const header = ref(null)
const headerInner = ref(null)
const brandGroup = ref(null)
const nav = ref(null)
const profile = ref(null)
const isCollapsed = ref(false)
const menuOpen = ref(false)
// Once the page scrolls, the bar turns into frosted glass over the content.
const isScrolled = ref(false)
let resizeObserver
let scrollFrame

function onScroll() {
  if (scrollFrame) return
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = null
    isScrolled.value = window.scrollY > 8
  })
}

function updateCollapsed() {
  if (isLanding.value || !nav.value) {
    isCollapsed.value = false
    return
  }
  const gap = parseFloat(getComputedStyle(headerInner.value).columnGap) || 0
  const needed =
    brandGroup.value.offsetWidth + nav.value.scrollWidth + profile.value.offsetWidth + gap * 2
  isCollapsed.value = needed > headerInner.value.clientWidth
  if (!isCollapsed.value) menuOpen.value = false
}

function closeMenu() {
  menuOpen.value = false
}

function onKeydown(event) {
  if (event.key === 'Escape' && menuOpen.value) closeMenu()
}

function onPointerDown(event) {
  if (menuOpen.value && !header.value.contains(event.target)) closeMenu()
}

onMounted(() => {
  resizeObserver = new ResizeObserver(updateCollapsed)
  resizeObserver.observe(header.value)
  // Web fonts change the link widths once they load.
  document.fonts?.ready.then(updateCollapsed)
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('pointerdown', onPointerDown)
  window.removeEventListener('scroll', onScroll)
  cancelAnimationFrame(scrollFrame)
})

watch(
  () => route.fullPath,
  async () => {
    closeMenu()
    await nextTick()
    updateCollapsed()
  },
)
</script>

<template>
  <header
    ref="header"
    class="site-header"
    :class="{
      'site-header-landing': isLanding,
      'site-header-dashboard': isListeningPage,
      'is-scrolled': isScrolled || menuOpen,
    }"
  >
    <div ref="headerInner" class="header-inner">
      <div ref="brandGroup" class="brand-group">
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

      <nav
        v-else
        ref="nav"
        class="header-nav"
        :class="{ 'is-collapsed': isCollapsed }"
        aria-label="Main navigation"
        :aria-hidden="isCollapsed || undefined"
        :inert="isCollapsed"
      >
        <RouterLink v-for="link in links" :key="link.to" class="header-link" :to="link.to">
          {{ link.label }}
        </RouterLink>
        <RouterLink
          class="header-cta"
          :class="isListeningPage ? 'dashboard-signin' : 'glass-action'"
          to="/login"
          >Sign in</RouterLink
        >
      </nav>

      <button
        v-if="isCollapsed"
        type="button"
        class="menu-button"
        :class="{ 'is-open': menuOpen }"
        :aria-expanded="menuOpen"
        aria-controls="site-menu"
        :aria-label="menuOpen ? 'Close menu' : 'Open menu'"
        @click="menuOpen = !menuOpen"
      >
        <span class="menu-bars" aria-hidden="true" />
      </button>

      <!-- Placeholder until the profile page exists; swap for a RouterLink then. -->
      <button
        ref="profile"
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

    <nav
      v-if="isCollapsed"
      v-show="menuOpen"
      id="site-menu"
      class="site-menu"
      aria-label="Main navigation"
    >
      <RouterLink v-for="link in links" :key="link.to" class="menu-link" :to="link.to">
        {{ link.label }}
      </RouterLink>
      <RouterLink class="header-cta glass-action menu-cta" to="/login">Sign in</RouterLink>
    </nav>
  </header>
</template>

<style scoped>
/* Sticks to the top of the window; turns to frosted glass once you scroll. */
.site-header {
  position: sticky;
  top: 0;
  z-index: 40;
  width: 100%;
  border-bottom: 1px solid #998ba155;
  background: #faf8f6;
  transition:
    background-color 220ms ease,
    box-shadow 220ms ease,
    border-color 220ms ease;
}
.site-header.is-scrolled {
  border-bottom-color: rgba(153, 139, 161, 0.25);
  background: rgba(250, 248, 246, 0.72);
  box-shadow: 0 6px 20px rgba(41, 35, 33, 0.08);
  backdrop-filter: blur(16px) saturate(1.4);
  -webkit-backdrop-filter: blur(16px) saturate(1.4);
}
@media (prefers-reduced-transparency: reduce) {
  .site-header.is-scrolled {
    background: #faf8f6;
  }
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
  flex-shrink: 0;
  white-space: nowrap;
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
/* Folded away, but still laid out at full width so it can be measured. */
.header-nav.is-collapsed {
  position: absolute;
  visibility: hidden;
  pointer-events: none;
}
.menu-button {
  display: inline-flex;
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  margin-left: auto;
  border: 1px solid #998ba155;
  border-radius: 12px;
  color: #625a53;
  background: #fff;
  cursor: pointer;
}
.menu-button:hover {
  border-color: #cd6651;
  color: #cd6651;
}
.menu-button:focus-visible {
  outline: 2px solid #cd6651;
  outline-offset: 3px;
}
/* Three bars that turn into a cross when the menu is open. */
.menu-bars,
.menu-bars::before,
.menu-bars::after {
  display: block;
  width: 18px;
  height: 2px;
  border-radius: 2px;
  background: currentColor;
  transition: transform 200ms ease, opacity 200ms ease;
}
.menu-bars {
  position: relative;
}
.menu-bars::before,
.menu-bars::after {
  position: absolute;
  left: 0;
  content: '';
}
.menu-bars::before {
  top: -6px;
}
.menu-bars::after {
  top: 6px;
}
.menu-button.is-open .menu-bars {
  background: transparent;
}
.menu-button.is-open .menu-bars::before {
  transform: translateY(6px) rotate(45deg);
}
.menu-button.is-open .menu-bars::after {
  transform: translateY(-6px) rotate(-45deg);
}
.site-menu {
  position: absolute;
  top: 100%;
  right: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  /* Lines up with the header content above it. */
  padding: 10px max(32px, calc((100% - 1180px) / 2)) 18px;
  border-bottom: 1px solid #998ba155;
  /* Solid: a blurred panel inside the blurred bar lets the page show through. */
  background: #faf8f6;
  box-shadow: 0 12px 24px rgba(41, 35, 33, 0.12);
}
.menu-link {
  padding: 12px 10px;
  border-radius: 10px;
  color: #625a53;
  font-size: 1rem;
  font-weight: 600;
  text-decoration: none;
}
.menu-link:hover {
  color: #cd6651;
  background: #f0eae6;
}
.menu-link.router-link-exact-active {
  color: #a54b3b;
  background: #f5e6e0;
}
.menu-link:focus-visible {
  outline: 2px solid #cd6651;
  outline-offset: -2px;
}
.menu-cta {
  align-self: flex-start;
  min-width: 160px;
  margin-top: 10px;
}
/* Keep the menu and profile buttons together, closer than the header's gap. */
.menu-button + .profile-button {
  margin-left: -14px;
}
@media (prefers-reduced-motion: reduce) {
  .menu-bars,
  .menu-bars::before,
  .menu-bars::after {
    transition: none;
  }
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

/* Dark mode: the bar matches the app's navy page and turns into dark glass on scroll. */
.dark .site-header {
  border-bottom-color: rgba(255, 255, 255, 0.08);
  background: #171b27;
}
.dark .site-header.is-scrolled {
  border-bottom-color: rgba(255, 255, 255, 0.1);
  background: rgba(23, 27, 39, 0.72);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
}
.dark .brand {
  color: #f5f1ee;
}
.dark .header-link,
.dark .menu-link {
  color: #c9c2cf;
}
.dark .header-link:hover,
.dark .menu-link:hover {
  color: #eaa596;
}
.dark .header-link.router-link-exact-active,
.dark .menu-link.router-link-exact-active {
  color: #eaa596;
}
.dark .theme-toggle {
  border-color: rgba(255, 255, 255, 0.12);
  background: #222839;
}
.dark .theme-thumb {
  background: #3a4256;
}
.dark .theme-toggle.is-dark .theme-thumb {
  background: #30384a;
}
.dark .theme-icon {
  stroke: #7d7888;
}
.dark .theme-toggle.is-dark .theme-moon {
  stroke: #ffcda6;
}
.dark .profile-button,
.dark .menu-button {
  border-color: rgba(255, 255, 255, 0.12);
  color: #c9c2cf;
  background: #222839;
}
.dark .profile-button:hover,
.dark .menu-button:hover {
  border-color: #db806d;
  color: #eaa596;
}
.dark .site-menu {
  border-bottom-color: rgba(255, 255, 255, 0.08);
  background: #171b27;
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.4);
}
.dark .menu-link:hover {
  background: rgba(255, 255, 255, 0.06);
}
.dark .menu-link.router-link-exact-active {
  background: rgba(219, 128, 109, 0.16);
}
@media (prefers-reduced-transparency: reduce) {
  .dark .site-header.is-scrolled {
    background: #171b27;
  }
}

@media (max-width: 600px) {
  .header-inner { width: calc(100% - 36px); min-height: 66px; }
  .brand { font-size: 1.48rem; }
  .header-nav { gap: 14px; }
  .header-cta { min-height: 42px; padding-inline: 17px; }
  .header-inner { gap: 12px; }
  .brand-group { gap: 10px; }
  .profile-button,
  .menu-button { width: 38px; height: 38px; }
  .menu-button + .profile-button { margin-left: -4px; }
  .site-menu { padding-inline: 18px; }
  .menu-cta { align-self: stretch; }
  .brand, .header-cta { white-space: nowrap; }
  .theme-toggle { width: 54px; height: 30px; padding: 0 6px; }
  .theme-thumb { width: 22px; height: 22px; }
  .theme-toggle.is-dark .theme-thumb { transform: translateX(24px); }
  .theme-icon { width: 14px; height: 14px; }
  .site-header-landing .header-cta { padding-inline: 12px; }

}
</style>
