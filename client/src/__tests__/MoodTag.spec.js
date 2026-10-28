import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MoodTag from '../components/mood/MoodTag.vue'
import { getTrackMoods } from '@/api/tracks'
import { useAuthStore } from '@/stores/auth'

vi.mock('@/api/tracks', () => ({ getTrackMoods: vi.fn() }))

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
    lyricsPending: false,
  },
  serene: { sound: { name: 'Serene', axis: 'relaxed' }, lyrics: null, lyricsPending: true },
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
    }))
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

    expect(wrapper.find('.badge').text()).toContain('Serene')
    expect(wrapper.find('.tooltip').attributes('data-text')).toContain(
      'lyrics haven’t been read yet',
    )
  })

  it('shows a grey Analysing tag for songs the job hasn’t reached', async () => {
    logIn({ id: 'user-3', preferences: { moodLens: 'lyrics' } })
    const wrapper = mountTag('waiting')
    await flushPromises()

    expect(wrapper.find('.badge').attributes('data-color')).toBe('neutral')
    expect(wrapper.text()).toContain('Analysing…')
  })

  it('shows nothing for songs with no mood', async () => {
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

  it('asks nothing for logged-out visitors', async () => {
    const wrapper = mountTag('kicks')
    await flushPromises()

    expect(getTrackMoods).not.toHaveBeenCalled()
    expect(wrapper.find('.badge').exists()).toBe(false)
  })
})
