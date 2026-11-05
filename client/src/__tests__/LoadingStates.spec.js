import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import InlineLoader from '../components/layout/InlineLoader.vue'
import PastEntries from '../components/journal/PastEntries.vue'
import SongSearch from '../components/landing/SongSearch.vue'
import { searchSongs } from '@/api/songs'

vi.mock('@/api/songs', () => ({ getSongAnalysis: vi.fn(), searchSongs: vi.fn() }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ user: null }) }))

describe('The small loader', () => {
  it('announces its text and hides the spinner from screen readers', () => {
    const loader = mount(InlineLoader, { props: { label: 'Searching…' } })
    expect(loader.attributes('role')).toBe('status')
    expect(loader.text()).toBe('Searching…')
    expect(loader.find('.spin-ring').attributes('aria-hidden')).toBe('true')
  })
})

describe('Past entries', () => {
  it('shows the spinning record while they load', () => {
    const entries = mount(PastEntries, {
      props: { entries: [], isLoading: true },
      global: { stubs: { MoodFace: true, JournalDrawingNote: true } },
    })
    expect(entries.find('.record-loader').text()).toBe('Loading your entries…')
  })
})

describe('The landing song search', () => {
  const mountSearch = () =>
    mount(SongSearch, {
      global: {
        stubs: {
          UInput: {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template: '<input :value="modelValue" @input="$emit(`update:modelValue`, $event.target.value)" />',
          },
          UButton: { template: '<button><slot /></button>' },
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    })

  it('shows it is looking from the first key press until the answer arrives', async () => {
    vi.useFakeTimers()
    let finish
    searchSongs.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    const search = mountSearch()
    await search.find('input').setValue('creep')
    expect(search.find('.search-status').text()).toBe('Looking for songs…')

    await vi.advanceTimersByTimeAsync(300)
    expect(search.find('.search-status').exists()).toBe(true)

    finish([])
    vi.useRealTimers()
    await flushPromises()
    expect(search.find('.search-status').exists()).toBe(false)
  })

  it('stops looking when the box is cleared', async () => {
    const search = mountSearch()
    await search.find('input').setValue('creep')
    await search.find('input').setValue('')
    expect(search.find('.search-status').exists()).toBe(false)
  })
})
