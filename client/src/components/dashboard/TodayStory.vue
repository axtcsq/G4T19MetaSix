<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import StoryMode from '@/components/landing/StoryMode.vue'
import ButterflyMark from '@/components/layout/ButterflyMark.vue'
import { getListens } from '@/api/listens'
import { getMoods } from '@/api/moods'
import { getTrackMoods } from '@/api/tracks'

// "Your day" on Home: a story ring that opens a tap-through story of the
// user's day (their logged mood, what they played and how it sounded), with a
// one-line summary beside it, and a reminder when today's mood isn't logged.
// With no plays today, the story shows their last day of listening instead.
const MOOD_COLOURS = {
  Sad: '#4389d1',
  Happy: '#f2c335',
  Relaxed: '#998ba1',
  Anxious: '#ed8a35',
  Angry: '#d94a45',
}
const MOOD_EMOJI = { Sad: '😢', Happy: '😊', Relaxed: '😌', Anxious: '😟', Angry: '😠' }
const AXIS_MOOD = {
  sad: 'Sad',
  happy: 'Happy',
  relaxed: 'Relaxed',
  anxious: 'Anxious',
  angry: 'Angry',
}
const DAYS_BACK = 7
const SNIPPET = 140

const loaded = ref(false)
const listens = ref([])
const todayLog = ref(null)

const dateKey = (date) => date.toLocaleDateString('en-CA')
const todayKey = dateKey(new Date())
const todayTitle = new Date().toLocaleDateString('en-SG', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

// The plays of today, or of the last day with any.
const day = computed(() => {
  if (!listens.value.length) return null
  const latest = dateKey(new Date(listens.value[0].played_at))
  const key = listens.value.some((item) => dateKey(new Date(item.played_at)) === todayKey)
    ? todayKey
    : latest
  const items = listens.value.filter((item) => dateKey(new Date(item.played_at)) === key)
  const label = new Date(items[0].played_at).toLocaleDateString('en-SG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  return { isToday: key === todayKey, label, items }
})

function mostCommon(values) {
  const counts = new Map()
  for (const value of values)
    counts.set(value.key, { ...value, count: (counts.get(value.key)?.count ?? 0) + 1 })
  return [...counts.values()].sort((a, b) => b.count - a.count)[0] ?? null
}

const topSong = computed(() =>
  day.value
    ? mostCommon(day.value.items.map((item) => ({ key: item.track.id, track: item.track })))
    : null,
)

const topMood = computed(() => {
  if (!day.value) return null
  const readings = day.value.items
    .map((item) => item.moods?.lyrics ?? item.moods?.sound)
    .filter((reading) => reading?.name)
  return mostCommon(readings.map((reading) => ({ key: reading.name, name: reading.name })))
})

// The journal mood the top music mood counts towards, from the mood tags
// endpoint (listens only carry the music mood's name).
const topMoodJournal = ref('')
watch(topMood, async (mood) => {
  topMoodJournal.value = ''
  const item =
    mood &&
    day.value.items.find((entry) => (entry.moods?.lyrics ?? entry.moods?.sound)?.name === mood.name)
  if (!item) return
  try {
    const { moods } = await getTrackMoods([item.track.id])
    const tag = moods?.[item.track.id]
    topMoodJournal.value = AXIS_MOOD[(tag?.lyrics ?? tag?.sound)?.axis] ?? ''
  } catch {
    // The story just leaves the comparison out.
  }
})

const minutes = computed(() =>
  Math.round(
    day.value?.items.reduce((sum, item) => sum + (item.track.duration_ms ?? 0), 0) / 60000 || 0,
  ),
)

// Whether the music's main mood matches the one logged today, when both are today's.
const matchLine = computed(() => {
  const journal = topMoodJournal.value
  if (!todayLog.value || !day.value?.isToday || !journal) return ''
  return journal === todayLog.value.mood
    ? 'That matches how you said you felt.'
    : `You logged ${todayLog.value.mood}, so your music told a different story.`
})

const summary = computed(() => {
  const music = !day.value
    ? 'No songs yet.'
    : day.value.isToday
      ? `${day.value.items.length} ${day.value.items.length === 1 ? 'song' : 'songs'} today${topMood.value ? `, mostly ${topMood.value.name.toLowerCase()}` : ''}.`
      : `Nothing played today yet. Last listened ${day.value.label}.`
  const feeling = todayLog.value ? ` You felt ${todayLog.value.mood}.` : ''
  return music + feeling
})

const slides = computed(() => {
  const list = [
    {
      kicker: 'Your day',
      title: todayTitle,
      text: 'A quick look at today, from your journal and your music.',
      colour: '#7d4737',
    },
  ]

  const log = todayLog.value
  if (log) {
    const words = log.journal?.trim()
    list.push({
      kicker: 'You felt',
      big: MOOD_EMOJI[log.mood],
      title: log.mood,
      text: words
        ? `“${words.length > SNIPPET ? `${words.slice(0, SNIPPET).trimEnd()}…` : words}”`
        : 'You logged your mood without any words today.',
      colour: MOOD_COLOURS[log.mood],
    })
  } else {
    list.push({
      kicker: 'Your journal',
      big: '✍️',
      title: 'You haven’t checked in yet.',
      text: 'A minute is all it takes to log how today feels.',
      colour: '#665f78',
      link: { to: '/daily-mood', text: 'Log today’s mood' },
    })
  }

  if (day.value) {
    const plays = day.value.items.length
    list.push({
      kicker: day.value.isToday ? 'Today' : `Last listened · ${day.value.label}`,
      big: String(plays),
      title: plays === 1 ? 'song played' : 'songs played',
      text: minutes.value ? `About ${minutes.value} minutes of music.` : 'Every play counts.',
      colour: '#cd6651',
    })
    if (topMood.value) {
      list.push({
        kicker: 'Your music sounded',
        title: topMood.value.name,
        text: `${topMood.value.count} of ${plays} plays. ${matchLine.value}`.trim(),
        colour: '#4389d1',
      })
    }
    const song = topSong.value
    list.push({
      kicker: 'On repeat',
      image: song.track.album?.images?.[0]?.url,
      title: song.track.name,
      text: `${song.track.artists.map((artist) => artist.name).join(', ')}. Played ${song.count} ${song.count === 1 ? 'time' : 'times'}.`,
      colour: '#665f78',
    })
  } else {
    list.push({
      kicker: 'Your music',
      big: '🎧',
      title: 'A quiet day so far.',
      text: 'Play something on Spotify and it will show up here.',
      colour: '#4389d1',
    })
  }

  list.push(
    log
      ? {
          kicker: 'That’s your day',
          title: 'See you tomorrow.',
          text: 'Your mood and music are saved in your calendar.',
          colour: '#763e32',
          last: true,
        }
      : {
          kicker: 'That’s your day',
          title: 'One thing left.',
          text: 'Log how you feel, so today’s story is complete.',
          colour: '#763e32',
          last: true,
        },
  )
  return list
})

const finish = computed(() =>
  todayLog.value
    ? { to: '/calendar', text: 'Open your calendar' }
    : { to: '/daily-mood', text: 'Log today’s mood' },
)
const ringArt = computed(() => topSong.value?.track.album?.images?.[0]?.url)

onMounted(async () => {
  const from = new Date()
  from.setHours(0, 0, 0, 0)
  from.setDate(from.getDate() - DAYS_BACK)
  const [plays, moods] = await Promise.allSettled([getListens({ from, limit: 500 }), getMoods()])
  if (plays.status === 'fulfilled') listens.value = plays.value.items ?? []
  if (moods.status === 'fulfilled') {
    todayLog.value =
      (moods.value ?? []).find((log) => dateKey(new Date(log.createdAt)) === todayKey) ?? null
  }
  loaded.value = true
})
</script>

<template>
  <section v-if="loaded" class="today" aria-label="Your day">
    <StoryMode :slides="slides" label="Your day, as a story" :finish="finish">
      <template #trigger="{ open }">
        <button type="button" class="today-ring" :class="{ 'is-new': !todayLog }" @click="open">
          <span class="ring-inner">
            <img v-if="ringArt" :src="ringArt" alt="" width="64" height="64" />
            <ButterflyMark v-else :size="30" />
          </span>
          <span class="sr-only">Watch your day as a story</span>
        </button>
      </template>
    </StoryMode>

    <div class="today-copy">
      <p class="today-kicker">Your day · {{ todayTitle }}</p>
      <p class="today-line">{{ summary }}</p>
    </div>

    <p v-if="!todayLog" class="today-reminder" role="status">
      <span class="reminder-dot" aria-hidden="true" />
      You haven’t logged today’s mood yet.
      <RouterLink to="/daily-mood" class="reminder-link"
        >Log it now <span aria-hidden="true">→</span></RouterLink
      >
    </p>
  </section>
</template>

<style scoped>
.today {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px 18px;
  margin-bottom: 24px;
  padding: 14px 18px;
  border: 1px solid var(--ui-border);
  border-radius: 18px;
  background: var(--ui-bg-elevated);
  box-shadow: 0 6px 18px rgba(125, 71, 55, 0.08);
}

/* An Instagram-style ring: brand gradient while there's something new to do
   (today's mood isn't logged), a quiet ring once it is. */
.today-ring {
  display: grid;
  width: 76px;
  height: 76px;
  flex-shrink: 0;
  place-items: center;
  padding: 3px;
  border: 0;
  border-radius: 50%;
  background: var(--ui-border-accented);
  cursor: pointer;
  transition: transform 160ms ease;
}
.today-ring.is-new {
  background: conic-gradient(from 200deg, #f2c335, #cd6651, #998ba1, #4389d1, #f2c335);
}
.today-ring:hover {
  transform: scale(1.04);
}
.today-ring:focus-visible {
  outline: 3px solid var(--color-brand-400);
  outline-offset: 3px;
}
.ring-inner {
  display: grid;
  width: 100%;
  height: 100%;
  overflow: hidden;
  place-items: center;
  border: 3px solid var(--ui-bg-elevated);
  border-radius: 50%;
  color: var(--ui-primary);
  background: var(--ui-bg);
}
.ring-inner img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.today-copy {
  min-width: 0;
  flex: 1 1 240px;
}
.today-kicker {
  margin: 0;
  color: var(--ui-text-muted);
  font-family: var(--font-sans);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.today-line {
  margin: 4px 0 0;
  color: var(--ui-text);
  font-family: var(--font-serif);
  font-size: 1.15rem;
  line-height: 1.35;
}

.today-reminder {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  margin: 0;
  padding: 10px 14px;
  border-radius: 12px;
  color: var(--ui-text);
  background: color-mix(in srgb, var(--ui-primary) 12%, transparent);
  font-family: var(--font-sans);
  font-size: 0.9rem;
}
.reminder-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ui-primary);
  animation: pulse 1.8s ease-in-out infinite;
}
.reminder-link {
  color: var(--ui-primary);
  font-weight: 700;
  text-decoration: none;
}
.reminder-link:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}
.reminder-link:focus-visible {
  outline: 3px solid var(--color-brand-400);
  outline-offset: 2px;
  border-radius: 4px;
}

@keyframes pulse {
  50% {
    opacity: 0.35;
  }
}

@media (prefers-reduced-motion: reduce) {
  .today-ring,
  .reminder-dot {
    transition: none;
    animation: none;
  }
}
</style>
