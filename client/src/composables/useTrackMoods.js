import { reactive, watch } from 'vue'
import { addSoundMoods, getTrackMoods } from '@/api/tracks'
import { useAuthStore } from '@/stores/auth'

const MAX_IDS = 100
// How many unplayed songs the server works out at once.
const MAX_NEW_SONGS = 10
// A song still being analysed is asked about again after this long, up to
// MAX_RECHECKS times while the page stays open.
const ANALYSING_TTL_MS = 2 * 60 * 1000
const MAX_RECHECKS = 10

// One cache for every mood tag on every page: ID -> { tag, at }. tag is the
// server's answer, or null for no tag.
const cache = reactive(new Map())
const queued = new Set()
const rechecks = new Map()
let flushing = null
let owner = null

const ownerKey = (user) => (user ? `${user.id}:${user.preferences?.moodLens}` : null)

function isFresh(entry) {
  return entry && !(entry.tag?.analysing && Date.now() - entry.at > ANALYSING_TTL_MS)
}

function queue(id) {
  queued.add(id)
  if (!flushing) flushing = Promise.resolve().then(flush)
}

// Asks about a song again later while it's still waiting for the analysis job,
// so its tag updates without reloading the page.
function scheduleRecheck(id) {
  const count = rechecks.get(id) ?? 0
  if (count >= MAX_RECHECKS) return
  rechecks.set(id, count + 1)
  const asker = owner
  setTimeout(() => {
    if (owner === asker && cache.get(id)?.tag?.analysing) queue(id)
  }, ANALYSING_TTL_MS)
}

function store(ids, moods) {
  const at = Date.now()
  for (const id of ids) {
    const tag = moods?.[id] ?? null
    cache.set(id, { tag, at })
    if (tag?.analysing) scheduleRecheck(id)
  }
}

// Songs with no sound reading yet (search results, or plays the sync only just
// saved) get it worked out by the server while they show "Analysing…".
async function addNewSongs(ids, asker) {
  const at = Date.now()
  for (const id of ids) cache.set(id, { tag: { analysing: true }, at })
  for (let i = 0; i < ids.length; i += MAX_NEW_SONGS) {
    const batch = ids.slice(i, i + MAX_NEW_SONGS)
    try {
      const { moods } = await addSoundMoods(batch)
      if (owner !== asker) return
      store(batch, moods)
    } catch {
      // Over the limit or unreachable: forget them, so they're asked about again.
      if (owner !== asker) return
      for (const id of batch) cache.delete(id)
    }
  }
}

async function flush() {
  const ids = [...queued]
  const asker = owner
  queued.clear()
  flushing = null
  const needsSound = []
  for (let i = 0; i < ids.length; i += MAX_IDS) {
    const batch = ids.slice(i, i + MAX_IDS)
    try {
      const answer = await getTrackMoods(batch)
      // An answer for a user who has since logged out is dropped.
      if (owner !== asker) return
      store(batch, answer.moods)
      needsSound.push(...(answer.needsSound ?? []))
    } catch {
      // No tags this time; asked again the next time a page shows them.
    }
  }
  if (needsSound.length) await addNewSongs(needsSound, asker)
}

// Asks for the moods of these songs, in one request with every other tag
// rendered at the same time. Logged-out visitors have no moods to show.
// The lyrics reading depends on who's asking and their lyrics setting, so
// logging out, switching user or changing the setting starts afresh.
function setOwner(user) {
  const key = ownerKey(user)
  if (owner === key) return
  owner = key
  cache.clear()
  queued.clear()
  rechecks.clear()
}

function request(ids) {
  const auth = useAuthStore()
  setOwner(auth.user)
  if (!auth.user) return
  for (const id of ids) {
    if (id && !isFresh(cache.get(id)) && !queued.has(id)) queue(id)
  }
}

// The mood tag for one song: { sound, lyrics, lyricsPending }, { analysing },
// or null for no tag (unknown song, no mood possible, or still loading).
export function useTrackMood(trackId) {
  const auth = useAuthStore()
  watch(
    [trackId, () => ownerKey(auth.user)],
    ([id]) => {
      if (id) request([id])
    },
    { immediate: true },
  )
  return () => (auth.user ? (cache.get(trackId.value)?.tag ?? null) : null)
}
