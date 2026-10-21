<script setup>
import { computed, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useListeningRoom } from '@/composables/useListeningRoom'
const route = useRoute()
const room = useListeningRoom()
const { connected, ready, track, paused, busy } = room
const visible = computed(() => connected.value && route.path !== '/listen')

// The dock floats over the page, so while it shows, the page keeps space for
// it at the bottom and it never covers the footer.
watch(visible, (shown) => document.documentElement.classList.toggle('has-dock', shown), {
  immediate: true,
})
onBeforeUnmount(() => document.documentElement.classList.remove('has-dock'))
</script>
<template>
  <aside
    v-if="visible"
    class="listening-dock"
    aria-label="Current Spotify playback"
  >
    <img v-if="track.album?.images?.length" :src="track.album.images[0].url" alt="" />
    <RouterLink to="/listen"
      ><strong>{{ track.name }}</strong
      ><span>Back to your listening room ↗</span></RouterLink
    >
    <button :disabled="!ready || !track.id || busy" @click="room.toggle">
      {{ paused ? 'Play' : 'Pause' }}
    </button>
    <button :disabled="busy" @click="room.disconnect">Disconnect</button>
  </aside>
</template>
<style>
/* The dock's height plus its gap from the edge. The footer, or the page when
   it has no footer, adds this much space at the bottom. */
html.has-dock {
  --dock-space: 96px;
  scroll-padding-bottom: var(--dock-space);
}
html.has-dock body:not(:has(.site-footer)) {
  padding-bottom: var(--dock-space);
}
</style>
<style scoped>
.listening-dock {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 15;
  display: flex;
  width: min(400px, calc(100% - 32px));
  gap: 10px;
  align-items: center;
  padding: 8px 10px;
  border: 1px solid var(--ui-border);
  border-radius: 16px;
  background: var(--ui-bg-elevated);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
  color: var(--ui-text);
  font-size: 13px;
}
img {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 10px;
  object-fit: cover;
}
a {
  flex: 1;
  min-width: 0;
  text-decoration: none;
}
strong,
span {
  display: block;
}
strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
span {
  margin-top: 4px;
  font-size: 11px;
}
button {
  min-height: 44px;
  flex-shrink: 0;
  padding: 8px;
  cursor: pointer;
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
button:focus-visible,
a:focus-visible {
  outline: 3px solid var(--color-brand-700);
  outline-offset: 3px;
}
</style>
