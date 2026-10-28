import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MoodTag from '../components/mood/MoodTag.vue'
import { addSoundMoods, getTrackMoods } from '@/api/tracks'
import { useAuthStore } from '@/stores/auth'

vi.mock('@/api/tracks', () => ({ addSoundMoods: vi.fn(), getTrackMoods: vi.fn() }))

const tooltip = {
  props: ['text'],
  template: '<span class="tooltip" :data-text="text"><slot /></span>',
}
const badge = {
  props: ['color'],
  template: '<span class="badge" :data-color="color"><slot /></span>',
}
// Nuxt UI's components are imported directly, so stub them by file name too.
const stubs = { UTooltip: tooltip, Tooltip: tooltip, UBadge: badge, Badge: badge }

const MOODS = {
  kicks: {
    sound: { name: 'Euphoric', axis: 'happy' },
    lyrics: { name: 'Deceptively upbeat', axis: 'anxious' },
    lyricsNote: null,
  },
  serene: { sound: { name: 'Serene', axis: 'relaxed' }, lyrics: null, lyricsNote: 'pending' },
  waiting: { analysing: true },
}

function mountTag(trackId) {
  return mount(MoodTag, { props: { trackId }, global: { stubs } })
}

let pinia
function logIn(user = { id: 'user-1', preferences: { moodLens: 'lyrics' } }) {
  useAuthStore(pinia).user = user
}

describe('MoodTag', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pinia = createPinia()
    setActivePinia(pinia)
    getTrackMoods.mockImplementation(async (ids) => ({
      moods: Object.fromEntries(ids.filter((id) => MOODS[id]).map((id) => [id, MOODS[id]])),
      needsSound: ids.filter((id) => id.startsWith('new-')),
    }))
    addSoundMoods.mockResolvedValue({ moods: {} })
  })

  it('shows the sound + lyrics mood in its journal colour, with both readings in the tooltip', async () => {
    logIn()
    const wrapper = mountTag('kicks')
    await flushPromises()

    const badge = wrapper.find('.badge')
    expect(badge.text()).toContain('Deceptively upbeat')
    expect(badge.attributes('data-color')).toBe('anxious')
    expect(wrapper.find('.tooltip').attributes('data-text')).toBe(
      'Deceptively upbeat from sound and lyrics; Euphoric from sound alone. Counts as Anxious.',
    )
  })

  it('falls back to the sound mood while the lyrics are pending', async () => {
    logIn({ id: 'user-2', preferences: { moodLens: 'lyrics' } })
    const wrapper = mountTag('serene')
    await flushPromises()

    const [mood, note] = wrapper.findAll('.badge')
    expect(mood.text()).toContain('Serene')
    expect(wrapper.find('.tooltip').attributes('data-text')).toBe(
      'Serene, from how the song sounds. Counts as Relaxed.',
    )
    expect(note.text()).toBe('Lyrics pending')
    expect(note.attributes('data-color')).toBe('neutral')
  })

  it('says when a song has no lyrics, and shows no second tag when the lyrics counted', async () => {
    logIn({ id: 'user-10', preferences: { moodLens: 'lyrics' } })
    MOODS.instrumental = {
      sound: { name: 'Serene', axis: 'relaxed' },
      lyrics: { name: 'Serene', axis: 'relaxed' },
      lyricsNote: 'instrumental',
    }
    const instrumental = mountTag('instrumental')
    const kicks = mountTag('kicks')
    await flushPromises()

    expect(instrumental.findAll('.badge').map((badge) => badge.text())).toEqual([
      'Song mood: Serene',
      'Instrumental',
    ])
    expect(kicks.findAll('.badge')).toHaveLength(1)
  })

  it('shows a grey Analysing tag for songs the job hasn’t reached', async () => {
    logIn({ id: 'user-3', preferences: { moodLens: 'lyrics' } })
    const wrapper = mountTag('waiting')
    await flushPromises()

    expect(wrapper.find('.badge').attributes('data-color')).toBe('neutral')
    expect(wrapper.text()).toContain('Analysing…')
  })

  it('shows a grey No mood data tag for songs that can never get one', async () => {
    logIn({ id: 'user-11', preferences: { moodLens: 'lyrics' } })
    MOODS.tooNew = { noMood: 'no-data' }
    const wrapper = mountTag('tooNew')
    await flushPromises()

    expect(wrapper.find('.badge').text()).toBe('Song mood: No mood data')
    expect(wrapper.find('.badge').attributes('data-color')).toBe('neutral')
    expect(wrapper.find('.tooltip').attributes('data-text')).toContain('common for new releases')
  })

  it('shows nothing for songs we know nothing about', async () => {
    logIn({ id: 'user-4', preferences: { moodLens: 'lyrics' } })
    const wrapper = mountTag('unknown-song')
    await flushPromises()

    expect(wrapper.find('.badge').exists()).toBe(false)
  })

  it('asks for every tag on the page in one request', async () => {
    logIn({ id: 'user-5', preferences: { moodLens: 'lyrics' } })
    mountTag('kicks')
    mountTag('serene')
    mountTag('waiting')
    await flushPromises()

    expect(getTrackMoods).toHaveBeenCalledTimes(1)
    expect(getTrackMoods.mock.calls[0][0].sort()).toEqual(['kicks', 'serene', 'waiting'])
  })

  it('hides the tags once the user logs out', async () => {
    logIn({ id: 'user-6', preferences: { moodLens: 'lyrics' } })
    const wrapper = mountTag('kicks')
    await flushPromises()
    expect(wrapper.find('.badge').exists()).toBe(true)

    useAuthStore(pinia).user = null
    await flushPromises()
    expect(wrapper.find('.badge').exists()).toBe(false)
  })

  it('works out the sound mood of a song nobody has played, showing Analysing meanwhile', async () => {
    logIn({ id: 'user-7', preferences: { moodLens: 'lyrics' } })
    let answer
    addSoundMoods.mockReturnValue(new Promise((resolve) => (answer = resolve)))
    const wrapper = mountTag('new-search-result')
    await flushPromises()

    expect(addSoundMoods).toHaveBeenCalledWith(['new-search-result'])
    expect(wrapper.text()).toContain('Analysing…')

    answer({
      moods: {
        'new-search-result': {
          sound: { name: 'Serene', axis: 'relaxed' },
          lyrics: null,
          lyricsNote: 'pending',
        },
      },
    })
    await flushPromises()
    expect(wrapper.find('.badge').text()).toContain('Serene')
    expect(wrapper.find('.badge').attributes('data-color')).toBe('relaxed')
  })

  it('shows nothing for a new song the server can’t place', async () => {
    logIn({ id: 'user-8', preferences: { moodLens: 'lyrics' } })
    const wrapper = mountTag('new-unknown-to-reccobeats')
    await flushPromises()

    expect(addSoundMoods).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.badge').exists()).toBe(false)
  })

  it('updates an Analysing tag by itself once the job has finished', async () => {
    vi.useFakeTimers()
    try {
      logIn({ id: 'user-9', preferences: { moodLens: 'lyrics' } })
      const wrapper = mountTag('waiting')
      await flushPromises()
      expect(wrapper.text()).toContain('Analysing…')

      MOODS.waiting = {
        sound: { name: 'Uplifting', axis: 'happy' },
        lyrics: null,
        lyricsNote: 'pending',
      }
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000)
      await flushPromises()
      expect(wrapper.find('.badge').text()).toContain('Uplifting')
    } finally {
      MOODS.waiting = { analysing: true }
      vi.useRealTimers()
    }
  })

  it('asks nothing for logged-out visitors', async () => {
    const wrapper = mountTag('kicks')
    await flushPromises()

    expect(getTrackMoods).not.toHaveBeenCalled()
    expect(wrapper.find('.badge').exists()).toBe(false)
  })
})
