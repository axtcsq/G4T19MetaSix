<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
defineOptions({ name: 'SiteNavbar' })

const route = useRoute()
const isLanding = computed(() => route.path === '/')
</script>

<template>
  <header
    class="site-header"
    :class="{
      'site-header-landing': isLanding,
      'site-header-dashboard': route.path === '/dashboard',
    }"
  >
    <div class="header-inner">
      <RouterLink class="brand" to="/" aria-label="MetaFor home">
        MetaFor<span class="brand-mark">®</span>
      </RouterLink>

      <nav v-if="isLanding" class="header-nav" aria-label="Main navigation">
        <RouterLink class="header-cta glass-action" to="/signup">Get started</RouterLink>
      </nav>

      <nav v-else class="header-nav" aria-label="Main navigation">
        <RouterLink class="header-link" to="/">Home</RouterLink>
        <RouterLink class="header-link" to="/dashboard">Dashboard</RouterLink>
        <RouterLink class="header-link" to="/daily-mood">Daily Mood</RouterLink>
        <RouterLink class="header-link" to="/canvas">Canvas</RouterLink>
        <RouterLink
          class="header-cta"
          :class="route.path === '/dashboard' ? 'dashboard-signin' : 'glass-action'"
          to="/login"
          >Sign in</RouterLink
        >
      </nav>
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
  .site-header:not(.site-header-landing) .header-inner {
    flex-wrap: wrap;
    gap: 0;
    padding-block: 12px;
  }
  .site-header:not(.site-header-landing) .header-nav {
    flex-wrap: wrap;
    width: 100%;
    justify-content: space-between;
    gap: 8px 12px;
    padding-top: 8px;
  }
  .header-inner {
    width: calc(100% - 36px);
    min-height: 66px;
  }
  .brand {
    font-size: 1.48rem;
  }
  .header-nav {
    gap: 14px;
  }
  .header-cta {
    min-height: 42px;
    padding-inline: 17px;
  }
  .site-header:not(.site-header-landing) .header-link {
    font-size: 0.86rem;
  }
}
</style>
