import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PersonalityHub from '../views/personality/personality-hub.vue'
import { getPersonality, getPersonalityTypes, getQuizzes } from '@/api/quiz'

vi.mock('@/api/quiz', () => ({
  getPersonality: vi.fn(),
  getPersonalityTypes: vi.fn(),
  getQuizzes: vi.fn(),
}))

const QUIZZES = [
  {
    id: 'music-mbti',
    title: 'Music MBTI',
    description: 'A quiz.',
    questionCount: 8,
    outcomes: [{ name: 'A result', meaning: 'What it means.' }],
    outcomeNote: null,
    latestResult: null,
  },
]
const TYPES = [
  { id: 'storm-chaser', name: 'The Storm Chaser', tagline: 'Loud.', description: 'Storm words.', traits: ['Amped', 'Explorer'] },
  { id: 'poet', name: 'The Poet', tagline: 'Words.', description: 'Poet words.', traits: ['Wordsmith', 'Solo'] },
]

const mountHub = async () => {
  const hub = mount(PersonalityHub, {
    global: {
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
        SiteFooter: true,
        WaveBackground: true,
        ShareCardDialog: true,
        PersonalityBreakdown: true,
        TraitBar: true,
      },
    },
  })
  await flushPromises()
  return hub
}
const typesTab = (hub) => hub.findAll('[role="tab"]').find((tab) => tab.text().includes('MetaFor Types'))

describe('MetaFor Types tab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getQuizzes.mockResolvedValue(QUIZZES)
    getPersonalityTypes.mockResolvedValue(TYPES)
    getPersonality.mockResolvedValue(null)
  })

  it('comes after the quiz tabs and shows every type when picked', async () => {
    const hub = await mountHub()
    const tabs = hub.findAll('[role="tab"]')
    expect(tabs.at(-1).text()).toContain('MetaFor Types')
    expect(tabs.at(-1).attributes('aria-selected')).toBe('false')
    expect(hub.text()).toContain('A result')

    await tabs.at(-1).trigger('click')
    expect(tabs.at(-1).attributes('aria-selected')).toBe('true')
    expect(tabs[0].attributes('aria-selected')).toBe('false')
    expect(hub.find('#outcomes-panel').text()).toContain('The Storm Chaser')
    expect(hub.find('#outcomes-panel').text()).toContain('Poet words.')
    expect(hub.find('#outcomes-panel').text()).toContain('Wordsmith')
    expect(hub.find('#outcomes-panel').text()).not.toContain('A result')
    expect(hub.find('#outcomes-panel').text()).not.toContain('Your type')
  })

  it("puts the user's own type first with a badge", async () => {
    getPersonality.mockResolvedValue({ type: { id: 'poet', name: 'The Poet' }, traits: [], insights: [], quizResults: [] })
    const hub = await mountHub()
    await typesTab(hub).trigger('click')
    const cards = hub.findAll('#outcomes-panel .outcome-card')
    expect(cards[0].text()).toContain('Your type')
    expect(cards[0].text()).toContain('The Poet')
    expect(cards[1].text()).not.toContain('Your type')
  })

  it('goes back to a quiz when its tab is picked', async () => {
    const hub = await mountHub()
    await typesTab(hub).trigger('click')
    await hub.findAll('[role="tab"]')[0].trigger('click')
    expect(hub.find('#outcomes-panel').text()).toContain('A result')
    expect(typesTab(hub).attributes('aria-selected')).toBe('false')
  })

  it('stays hidden if the types fail to load, leaving the quizzes working', async () => {
    getPersonalityTypes.mockRejectedValue(new Error('offline'))
    const hub = await mountHub()
    expect(typesTab(hub)).toBeUndefined()
    expect(hub.text()).toContain('A result')
  })
})
