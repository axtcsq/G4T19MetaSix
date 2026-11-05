import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TodayStory from '../components/dashboard/TodayStory.vue'
import { METAPHORS, metaphorFor } from '@/data/dailyMetaphors'
import { getDailyMetaphor } from '@/api/auth'
import { getListens } from '@/api/listens'
import { getMoods } from '@/api/moods'
import { useAuthStore } from '@/stores/auth'
import { useTodayMoodStore } from '@/stores/todayMood'

vi.mock('@/api/auth', () => ({ getDailyMetaphor: vi.fn() }))
vi.mock('@/api/listens', () => ({ getListens: vi.fn() }))
vi.mock('@/api/moods', () => ({ getMoods: vi.fn() }))
vi.mock('@/api/tracks', () => ({ getTrackMoods: vi.fn() }))

describe('Daily metaphor', () => {
  let pinia
  beforeEach(() => {
    vi.clearAllMocks()
    pinia = createPinia()
    setActivePinia(pinia)
    getListens.mockResolvedValue({ items: [] })
    getMoods.mockResolvedValue([])
    useAuthStore().user = { id: 'u1' }
  })

  // The slides the story was given, with the player itself stubbed out.
  const mountStory = async () => {
    const story = mount(TodayStory, {
      global: {
        plugins: [pinia],
        stubs: { StoryMode: { name: 'StoryMode', props: ['slides'], template: '<div />' }, RouterLink: true },
      },
    })
    await flushPromises()
    return story
  }
  const slides = (story) => story.findComponent({ name: 'StoryMode' }).props('slides')
  const metaphorSlide = (story) => slides(story).find((slide) => slide.kicker === 'Today’s metaphor')

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

  it("is the slide just before the story's last one, with the user's own line", async () => {
    getDailyMetaphor.mockResolvedValue({
      text: 'Your worry is a quiet indie bridge.',
      mood: 'Anxious',
      genre: 'indie',
      source: 'groq',
    })
    const list = slides(await mountStory())
    expect(list.at(-1).last).toBe(true)
    expect(list.at(-2).kicker).toBe('Today’s metaphor')
    expect(list.at(-2).quote).toBe('Your worry is a quiet indie bridge.')
    expect(list.at(-2).text).toBe('For an anxious day, with a little indie')
  })

  it('stays out of the card on Home', async () => {
    getDailyMetaphor.mockResolvedValue({ text: 'One line.', mood: 'Happy', genre: null, source: 'groq' })
    const story = await mountStory()
    expect(story.text()).not.toContain('One line.')
    expect(story.text()).not.toContain('metaphor')
  })

  it('asks again after a new check-in', async () => {
    getDailyMetaphor.mockResolvedValue({ text: 'One line.', mood: null, genre: 'jazz', source: 'groq' })
    const story = await mountStory()
    expect(metaphorSlide(story).text).toBe('For your jazz taste')

    getDailyMetaphor.mockResolvedValue({ text: 'A sunnier line.', mood: 'Happy', genre: null, source: 'mood' })
    useTodayMoodStore().add({ mood: 'Happy', createdAt: new Date().toISOString() })
    await flushPromises()
    expect(getDailyMetaphor).toHaveBeenCalledTimes(2)
    expect(metaphorSlide(story).quote).toBe('A sunnier line.')
    expect(metaphorSlide(story).text).toBe('For a happy day')
  })

  it('uses the general line if the request fails', async () => {
    getDailyMetaphor.mockRejectedValue(new Error('offline'))
    const story = await mountStory()
    expect(METAPHORS).toContain(metaphorSlide(story).quote)
    expect(metaphorSlide(story).text).toBe('')
  })
})
