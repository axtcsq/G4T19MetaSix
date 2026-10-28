<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import ButterflyMark from './ButterflyMark.vue'
import { useAuthStore } from '@/stores/auth'
defineOptions({ name: 'SiteNavbar' })

const route = useRoute()
const auth = useAuthStore()
const isLanding = computed(() => route.path === '/')
const isListeningPage = computed(() => ['/dashboard', '/listen'].includes(route.path))

const links = [
  { to: '/dashboard', label: 'Home' },
  { to: '/daily-mood', label: 'Daily Mood' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/listen', label: 'Listening Room' },
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
      'is-scrolled': isScrolled || menuOpen,
    }"
  >
    <div ref="headerInner" class="header-inner">
      <div ref="brandGroup" class="brand-group">
        <RouterLink class="brand" to="/" aria-label="MetaFor home">
          <ButterflyMark class="brand-butterfly" :size="30" />
          <span>MetaFor<span class="brand-mark">®</span></span>
        </RouterLink>

      </div>

      <nav v-if="isLanding" class="header-nav" aria-label="Main navigation">
        <RouterLink class="header-cta glass-action" :to="auth.user ? '/dashboard' : '/login'">{{
          auth.user ? 'Open MetaFor' : 'Get started'
        }}</RouterLink>
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
        <!-- Log out lives on the profile page. -->
        <RouterLink
          v-if="!auth.user"
          class="header-cta glass-action"
          :class="{ 'dashboard-signin': isListeningPage }"
          to="/login"
          >Sign in</RouterLink
        >
      </nav>

      <button
        v-if="isCollapsed"
        type="button"
        class="menu-button glass-icon"
        :class="{ 'is-open': menuOpen }"
        :aria-expanded="menuOpen"
        aria-controls="site-menu"
        :aria-label="menuOpen ? 'Close menu' : 'Open menu'"
        @click="menuOpen = !menuOpen"
      >
        <span class="menu-bars" aria-hidden="true" />
      </button>

      <!-- A plain <a> inside, so the fold measurement can read its width. -->
      <RouterLink v-slot="{ href, navigate, isActive }" to="/profile" custom>
        <a
          ref="profile"
          :href="href"
          class="profile-button glass-icon"
          :class="{ 'is-active': isActive }"
          :aria-current="isActive ? 'page' : undefined"
          :aria-label="auth.user ? `Your profile, logged in as ${auth.user.displayName}` : 'Your profile'"
          :title="auth.user ? `Your profile (${auth.user.displayName})` : 'Your profile'"
          @click="navigate"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
          </svg>
        </a>
      </RouterLink>
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
      <RouterLink v-if="!auth.user" class="header-cta glass-action menu-cta" to="/login">Sign in</RouterLink>
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
  /* The folded nav stays in the header at full width to be measured. Clipping
     stops it widening the page, which made phones zoom out. */
  overflow-x: clip;
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
  width: var(--page-width);
  min-height: 76px;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-inline: auto;
}
/* On the landing page the bar lines up with its wider margins. */
.site-header-landing .header-inner {
  width: var(--landing-width);
}
.brand-group {
  display: flex;
  align-items: center;
  gap: 14px;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #000;
  font-family: var(--font-serif);
  font-size: 1.7rem;
  font-weight: 700;
  letter-spacing: -0.055em;
  text-decoration: none;
}
.brand-butterfly {
  flex-shrink: 0;
  color: #b9543f;
}
.dark .brand-butterfly {
  color: #eaa596;
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
.profile-button:hover,
.profile-button.is-active {
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




/* Dark mode: the bar matches the app's espresso page and turns into dark glass on scroll. */
.dark .site-header {
  border-bottom-color: rgba(255, 255, 255, 0.08);
  background: #161210;
}
.dark .site-header.is-scrolled {
  border-bottom-color: rgba(255, 255, 255, 0.1);
  background: rgba(22, 18, 16, 0.72);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
}
.dark .brand {
  color: #f5f1ee;
}
.dark .header-link,
.dark .menu-link {
  color: #cdbfb6;
}
.dark .header-link:hover,
.dark .menu-link:hover {
  color: #eaa596;
}
.dark .header-link.router-link-exact-active,
.dark .menu-link.router-link-exact-active {
  color: #eaa596;
}
.dark .profile-button,
.dark .menu-button {
  border-color: rgba(255, 255, 255, 0.12);
  color: #cdbfb6;
  background: #211a17;
}
.dark .profile-button:hover,
.dark .profile-button.is-active,
.dark .menu-button:hover {
  border-color: #db806d;
  color: #eaa596;
}
.dark .site-menu {
  border-bottom-color: rgba(255, 255, 255, 0.08);
  background: #161210;
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
    background: #161210;
  }
}

@media (max-width: 600px) {
  .header-inner { min-height: 66px; }
  .brand { font-size: 1.48rem; gap: 5px; }
  .brand-butterfly { width: 26px; height: 23px; }
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
  /* The landing CTA leads into the app; omit the duplicate profile shortcut on phones. */
  .site-header-landing .profile-button { display: none; }
  .site-header-landing .header-inner { gap: 8px; }
  .site-header-landing .brand-group { gap: 6px; }
  .site-header-landing .header-cta { padding-inline: 10px; font-size: 0.8rem !important; }

}
</style>
