<script setup>
import MoodTag from '@/components/mood/MoodTag.vue'

defineProps({
  tracks: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  target: { type: String, default: '' },
})
defineEmits(['play'])
</script>

<template>
  <div v-if="loading" class="recommendation-list recommendation-skeleton" role="status" aria-label="Finding songs for you">
    <div v-for="card in 4" :key="card" class="recommendation-card skeleton-card" aria-hidden="true">
      <span class="skeleton-art" />
      <span class="skeleton-copy"><i /><i /><i /></span>
      <span class="skeleton-button" />
    </div>
  </div>
  <p v-else-if="error" class="recommendation-status" role="alert">{{ error }}</p>
  <div v-else-if="tracks.length" class="recommendation-list">
    <article v-for="track in tracks" :key="track.id" class="recommendation-card recommendation-card--arrive">
      <span class="art-link" aria-hidden="true">
        <img v-if="track.imageUrl" :src="track.imageUrl" alt="" />
        <span v-else class="track-art">♫</span>
      </span>
      <span class="track-copy">
        <RouterLink
          class="recommendation-title"
          :to="{ name: 'song', params: { id: track.id }, query: { from: 'calendar' } }"
        ><strong>{{ track.name }}</strong></RouterLink>
        <small>{{ track.artists.join(', ') }}</small>
        <small class="recommendation-source">{{ track.because }}</small>
        <MoodTag :track-id="track.id" size="sm" :link="false" :hide-pending-lyrics="track.instrumental" />
      </span>
      <button class="recommendation-open" type="button" @click="$emit('play', track)">Play song</button>
    </article>
  </div>
  <p v-else-if="!target" class="recommendation-status">Listen history with analyzed song moods will help shape suggestions for this month.</p>
  <p v-else class="recommendation-status">No songs by similar artists matched the mood this time. Try refreshing for other artists.</p>
</template>

<style scoped>
.recommendation-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 16px; }
.recommendation-card { display: flex; min-width: 0; align-items: center; gap: 10px; padding: 9px; border: 1px solid var(--ui-border); border-radius: 12px; color: inherit; background: var(--ui-bg-elevated); }
.recommendation-card img, .track-art, .skeleton-art { width: 48px; height: 48px; flex: 0 0 48px; border-radius: 8px; object-fit: cover; }
.track-art { display: grid; place-items: center; color: #fff; background: #81747c; font-size: 1.2rem; }
.track-copy { display: grid; min-width: 0; gap: 3px; }
.track-copy strong, .track-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.track-copy strong { font-size: .8rem; }
.track-copy small { color: var(--ui-text-muted); font-size: .7rem; }
.recommendation-source { color: var(--calendar-accent) !important; font-weight: 700; }
.recommendation-title { display: block; min-width: 0; border-radius: 4px; color: inherit; text-decoration: none; }
.recommendation-title:hover strong { text-decoration: underline; text-underline-offset: 3px; }
.recommendation-title:focus-visible, .recommendation-open:focus-visible { outline: 3px solid var(--color-brand-400); outline-offset: 2px; }
.recommendation-open { flex: 0 0 auto; margin-left: auto; padding: 7px 10px; border: 0; border-radius: 999px; color: var(--calendar-accent); background: var(--calendar-accent-soft); font: inherit; font-size: .72rem; font-weight: 700; cursor: pointer; }
.recommendation-status { margin: 14px 0 0; color: var(--ui-text-muted); font-size: .85rem; }
.skeleton-card { min-height: 68px; }
.skeleton-art, .skeleton-copy i, .skeleton-button { display: block; background: linear-gradient(100deg, var(--ui-bg-accented) 25%, color-mix(in srgb, var(--ui-bg-accented), white 45%) 45%, var(--ui-bg-accented) 65%); background-size: 220% 100%; animation: recommendation-shimmer 1.4s ease-in-out infinite; }
.skeleton-copy { display: grid; flex: 1; gap: 6px; }
.skeleton-copy i { width: 74%; height: 8px; border-radius: 99px; }
.skeleton-copy i:nth-child(2) { width: 52%; }
.skeleton-copy i:nth-child(3) { width: 38%; }
.skeleton-button { width: 70px; height: 28px; flex: 0 0 70px; border-radius: 99px; }
.recommendation-card--arrive { animation: recommendation-arrive .32s ease both; }
@keyframes recommendation-shimmer { to { background-position: -220% 0; } }
@keyframes recommendation-arrive { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@media (max-width: 768px) { .recommendation-list { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) { .skeleton-art, .skeleton-copy i, .skeleton-button, .recommendation-card--arrive { animation: none; } }
</style>
