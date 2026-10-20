<script setup>
import { useRoute } from 'vue-router'
import { useListeningRoom } from '@/composables/useListeningRoom'
const route = useRoute()
const room = useListeningRoom()
const { connected, ready, track, paused, busy } = room
</script>
<template>
  <aside
    v-if="connected && route.path !== '/listen'"
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
<style scoped>
.listening-dock {
  position: sticky;
  bottom: 0;
  z-index: 15;
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 14px max(18px, calc((100% - 1180px) / 2));
  background: var(--ui-bg-elevated);
  color: var(--ui-text);
  font-size: 13px;
}
img {
  width: 44px;
  height: 44px;
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
  overflow-wrap: anywhere;
}
span {
  margin-top: 4px;
  font-size: 11px;
}
button {
  min-height: 44px;
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
