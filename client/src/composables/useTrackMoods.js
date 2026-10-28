import { reactive, watch } from 'vue'
import { getTrackMoods } from '@/api/tracks'
import { useAuthStore } from '@/stores/auth'

const MAX_IDS = 100
// A song still being analysed is asked about again after this long.
const ANALYSING_TTL_MS = 2 * 60 * 1000

// One cache for every mood tag on every page: ID -> { tag, at }. tag is the
// server's answer, or null for no tag.
const cache = reactive(new Map())
const queued = new Set()
let flushing = null
let owner = null

const ownerKey = (user) => (user ? `${user.id}:${user.preferences?.moodLens}` : null)

function isFresh(entry) {
  return entry && !(entry.tag?.analysing && Date.now() - entry.at > ANALYSING_TTL_MS)
}

async function flush() {
  const ids = [...queued]
  const asker = owner
  queued.clear()
  flushing = null
  for (let i = 0; i < ids.length; i += MAX_IDS) {
    const batch = ids.slice(i, i + MAX_IDS)
    try {
      const { moods } = await getTrackMoods(batch)
      // An answer for a user who has since logged out is dropped.
      if (owner !== asker) return
      const at = Date.now()
      for (const id of batch) cache.set(id, { tag: moods?.[id] ?? null, at })
    } catch {
      // No tags this time; asked again the next time a page shows them.
    }
  }
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
}

function request(ids) {
  const auth = useAuthStore()
  setOwner(auth.user)
  if (!auth.user) return
  for (const id of ids) {
    if (id && !isFresh(cache.get(id)) && !queued.has(id)) queued.add(id)
  }
  if (queued.size && !flushing) flushing = Promise.resolve().then(flush)
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
