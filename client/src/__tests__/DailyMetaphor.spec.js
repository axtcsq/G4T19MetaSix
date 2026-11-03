import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DailyMetaphor from '../components/dashboard/DailyMetaphor.vue'
import { METAPHORS, metaphorFor } from '@/data/dailyMetaphors'
import { getDailyMetaphor } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { useTodayMoodStore } from '@/stores/todayMood'

vi.mock('@/api/auth', () => ({ getDailyMetaphor: vi.fn() }))
vi.mock('@/api/moods', () => ({ getMoods: vi.fn() }))

describe('Daily metaphor', () => {
  let pinia
  beforeEach(() => {
    vi.clearAllMocks()
    pinia = createPinia()
    setActivePinia(pinia)
  })
  afterEach(() => vi.useRealTimers())
  const mountCard = () => mount(DailyMetaphor, { global: { plugins: [pinia] } })

  it('keeps the same general line all day and changes it the next day', () => {
    const morning = metaphorFor(new Date('2026-11-04T00:05:00'))
    expect(metaphorFor(new Date('2026-11-04T23:55:00'))).toBe(morning)
    expect(metaphorFor(new Date('2026-11-05T00:05:00'))).not.toBe(morning)
  })

  it('goes through every general line before repeating', () => {
    const seen = new Set()
    for (let day = 0; day < METAPHORS.length; day++) seen.add(metaphorFor(new Date(2026, 0, 1 + day, 12)))
    expect(seen.size).toBe(METAPHORS.length)
  })

  it("shows the general line when nobody's logged in", async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-04T09:00:00'))
    const card = mountCard()
    await flushPromises()
    expect(getDailyMetaphor).not.toHaveBeenCalled()
    expect(card.find('blockquote').text()).toBe(metaphorFor(new Date('2026-11-04T09:00:00')))
    expect(card.text()).not.toContain('For ')
  })

  it("shows the user's own line and what it was written for", async () => {
    useAuthStore().user = { id: 'u1' }
    getDailyMetaphor.mockResolvedValue({
      text: 'Your worry is a quiet indie bridge.',
      mood: 'Anxious',
      genre: 'indie',
      source: 'groq',
    })
    const card = mountCard()
    await flushPromises()
    expect(card.find('blockquote').text()).toBe('Your worry is a quiet indie bridge.')
    expect(card.text()).toContain('For an anxious day, with a little indie')
  })

  it('asks again after a new check-in', async () => {
    useAuthStore().user = { id: 'u1' }
    getDailyMetaphor.mockResolvedValue({ text: 'One line.', mood: null, genre: 'jazz', source: 'groq' })
    const card = mountCard()
    await flushPromises()
    expect(card.text()).toContain('For your jazz taste')

    getDailyMetaphor.mockResolvedValue({ text: 'A sunnier line.', mood: 'Happy', genre: null, source: 'mood' })
    useTodayMoodStore().add({ mood: 'Happy', createdAt: new Date().toISOString() })
    await flushPromises()
    expect(getDailyMetaphor).toHaveBeenCalledTimes(2)
    expect(card.find('blockquote').text()).toBe('A sunnier line.')
    expect(card.text()).toContain('For a happy day')
  })

  it('keeps the general line if the request fails', async () => {
    useAuthStore().user = { id: 'u1' }
    getDailyMetaphor.mockRejectedValue(new Error('offline'))
    const card = mountCard()
    await flushPromises()
    expect(METAPHORS).toContain(card.find('blockquote').text())
  })
})
