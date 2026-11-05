<script setup>
import { computed, ref, watch } from 'vue'
import { getStreak } from '@/api/moods'
import { useAuthStore } from '@/stores/auth'
import { useTodayMoodStore } from '@/stores/todayMood'

// Home's check-in streak. Every 7 days in a row earns a saver, which covers one missed day. The server does the counting.
const auth = useAuthStore()
const todayMood = useTodayMoodStore()
const streak = ref(null)

let request = 0
async function load() {
  const id = ++request
  if (!auth.user) {
    streak.value = null
    return
  }
  try {
    const result = await getStreak()
    if (id === request) streak.value = result
  } catch {
    // Home works without it.
    if (id === request) streak.value = null
  }
}
// A new check-in can start or extend the streak, so ask again.
watch([() => auth.user?.id, () => todayMood.entries.length], load, { immediate: true })

const note = computed(() => {
  const { days, checkedInToday, nextSaverIn, savedYesterday } = streak.value
  if (savedYesterday && !checkedInToday)
    return 'A streak saver covered yesterday. Check in today to keep going.'
  if (!days) return 'Check in today to start a streak.'
  if (!checkedInToday) return 'Check in today to keep it going.'
  if (nextSaverIn === null) return 'Checked in today. Your streak savers are full.'
  return `Checked in today. ${nextSaverIn} more ${nextSaverIn === 1 ? 'day' : 'days'} to earn a streak saver.`
})
</script>

<template>
  <section
    v-if="streak"
    class="check-in-streak"
    :class="{ 'is-lit': streak.days, 'is-waiting': streak.days && !streak.checkedInToday }"
    aria-label="Check-in streak"
  >
    <!-- A campfire while the streak is going, burnt-out logs without one. It burns lower until today's check-in. -->
    <svg class="campfire" viewBox="0 0 64 64" aria-hidden="true">
      <g v-if="streak.days" class="flames">
        <path
          class="flame-outer"
          d="M32 6c8 12 16 18 14 31-1 8-7 13-14 13s-13-5-14-13c-1-8 6-14 8-22 2 6 4 8 6 10 1-6 0-12 0-19z"
        />
        <path class="flame-inner" d="M32 24c5 7 8 11 7 17-1 5-4 7-7 7s-6-2-6-7c0-5 4-8 6-17z" />
        <circle class="spark" cx="26" cy="22" r="1.4" />
        <circle class="spark" cx="37" cy="18" r="1.2" />
        <circle class="spark" cx="31" cy="12" r="1" />
      </g>
      <path v-else class="smoke" d="M31 42c-4-6 4-10 0-16-3-5 3-8 1-14" />
      <g class="logs">
        <rect x="8" y="46" width="48" height="9" rx="4.5" transform="rotate(-14 32 50)" />
        <rect x="8" y="46" width="48" height="9" rx="4.5" transform="rotate(14 32 50)" />
      </g>
    </svg>

    <div class="streak-copy">
      <p class="streak-count">
        <strong>{{ streak.days }}</strong>
        {{ streak.days === 1 ? 'day' : 'days' }} in a row
      </p>
      <p class="streak-note">
        {{ note }}
        <RouterLink v-if="!streak.checkedInToday" class="streak-link" :to="{ name: 'daily-mood' }"
          >Check in</RouterLink
        >
      </p>
    </div>

    <div class="streak-savers">
      <span class="saver-icons">
        <svg
          v-for="slot in streak.maxSavers"
          :key="slot"
          class="saver"
          :class="{ 'is-earned': slot <= streak.savers }"
          viewBox="0 0 16 16"
          aria-hidden="true"
        >
          <path d="M8 1l6 2.5V8c0 3.5-2.6 6-6 7-3.4-1-6-3.5-6-7V3.5z" />
        </svg>
      </span>
      Streak savers
      <span class="sr-only">: {{ streak.savers }} of {{ streak.maxSavers }}</span>
    </div>
  </section>
</template>

<style scoped>
.check-in-streak {
  display: flex;
  align-items: center;
  gap: 20px;
  width: fit-content;
  max-width: 100%;
  margin: 0 0 24px;
  padding: 14px 26px 14px 16px;
  border: 1px solid var(--ui-border);
  border-radius: 22px;
  background: color-mix(in srgb, var(--ui-text) 4%, transparent);
  font-family: var(--font-sans);
}
.campfire {
  flex: none;
  width: 76px;
  height: 76px;
  overflow: visible;
}
.logs rect {
  fill: #8a5a3b;
}
.check-in-streak:not(.is-lit) .logs rect {
  fill: #3d3533;
}
.flames {
  transform-origin: 32px 50px;
}
/* The two flames sway at different speeds, so the fire never looks looped, and sparks float up out of it. */
.flame-outer,
.flame-inner {
  transform-box: fill-box;
  transform-origin: 50% 100%;
}
.flame-outer {
  fill: #ef7d32;
  animation: flicker 1.3s ease-in-out infinite alternate;
}
.flame-inner {
  fill: #f6c544;
  animation: flicker 0.8s ease-in-out infinite alternate-reverse;
}
.spark {
  fill: #f6c544;
  animation: spark-rise 2.4s ease-out infinite;
}
.spark:nth-of-type(2) {
  animation-delay: 0.8s;
}
.spark:nth-of-type(3) {
  animation-delay: 1.6s;
}
/* Before today's check-in the fire burns low, waiting for another log. */
.is-waiting .flames {
  opacity: 0.55;
  scale: 0.75;
}
.smoke {
  fill: none;
  stroke: var(--ui-text-muted);
  stroke-width: 2.5;
  stroke-linecap: round;
  opacity: 0.6;
  animation: drift 3s ease-in-out infinite;
}
.streak-copy {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.streak-count,
.streak-note {
  margin: 0;
}
.streak-count {
  color: var(--ui-text-muted);
  font-size: 1rem;
}
.streak-count strong {
  margin-right: 4px;
  color: var(--ui-text);
  font: italic 2.75rem/1 var(--font-serif);
}
.is-lit .streak-count strong {
  color: #e0692a;
}
.streak-note {
  font-size: 1rem;
}
/* Glows on hover like the landing page links. */
.streak-link {
  margin-left: 4px;
  color: var(--ui-primary);
  font-weight: 700;
  text-decoration: none;
  transition: text-shadow 200ms ease;
}
.streak-link:hover,
.streak-link:focus-visible {
  text-shadow:
    0 0 4px color-mix(in srgb, var(--ui-primary) 90%, transparent),
    0 0 12px color-mix(in srgb, var(--ui-primary) 70%, transparent),
    0 0 26px color-mix(in srgb, var(--ui-primary) 50%, transparent);
}
.streak-savers {
  display: grid;
  justify-items: center;
  gap: 4px;
  padding-left: 20px;
  border-left: 1px solid var(--ui-border);
  color: var(--ui-text-muted);
  font-size: 0.8rem;
  white-space: nowrap;
}
.saver-icons {
  display: flex;
  gap: 4px;
}
/* A shield for each saver, filled in once it's earned. */
.saver {
  width: 24px;
  height: 24px;
  fill: none;
  stroke: var(--ui-border-accented);
  stroke-width: 1.5;
}
.saver.is-earned {
  fill: #6aa6d9;
  stroke: #6aa6d9;
}
@keyframes flicker {
  from {
    transform: scale(1, 1) skewX(-4deg);
  }
  50% {
    transform: scale(0.92, 1.08) skewX(1deg);
  }
  to {
    transform: scale(1.04, 0.95) skewX(4deg);
  }
}
@keyframes spark-rise {
  from {
    opacity: 0;
    transform: translate(0, 10px);
  }
  20% {
    opacity: 1;
  }
  to {
    opacity: 0;
    transform: translate(3px, -14px);
  }
}
@keyframes drift {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  50% {
    opacity: 0.6;
  }
  to {
    opacity: 0;
    transform: translateY(-6px);
  }
}
@media (max-width: 600px) {
  .check-in-streak {
    flex-wrap: wrap;
  }
  .streak-savers {
    padding-left: 0;
    border-left: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .flame-outer,
  .flame-inner,
  .smoke {
    animation: none;
  }
  .spark {
    display: none;
  }
}
</style>
