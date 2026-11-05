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

  it('shows three types until Show all is pressed, like the quiz tabs', async () => {
    getPersonalityTypes.mockResolvedValue(
      ['a', 'b', 'c', 'd'].map((id) => ({ id, name: `Type ${id}`, tagline: '', description: '', traits: [] })),
    )
    const hub = await mountHub()
    await typesTab(hub).trigger('click')
    expect(hub.findAll('#outcomes-panel .outcome-card')).toHaveLength(3)

    const showAll = hub.find('.show-more')
    expect(showAll.text()).toContain('Show all 4 types')
    await showAll.trigger('click')
    expect(hub.findAll('#outcomes-panel .outcome-card')).toHaveLength(4)
    expect(showAll.text()).toContain('Show fewer')
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

describe('Your result ticket', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getPersonalityTypes.mockResolvedValue(TYPES)
    getPersonality.mockResolvedValue(null)
    getQuizzes.mockResolvedValue([{ ...QUIZZES[0], latestResult: { title: 'INFP', subtitle: 'The Dreamer' } }])
  })

  it('shows the result, with a link to it', async () => {
    const hub = await mountHub()
    const ticket = hub.find('.result-ticket')
    expect(ticket.text()).toContain('You got')
    expect(ticket.text()).toContain('INFP')
    expect(ticket.text()).toContain('The Dreamer')
    expect(ticket.find('.ticket-main').text()).toContain('View result')
    expect(hub.text()).not.toContain('Get Started')
  })

  it('asks before retaking, from the stub', async () => {
    const hub = await mountHub()
    const stub = hub.find('.ticket-stub')
    expect(stub.attributes('aria-label')).toBe('Retake Music MBTI')
    expect(hub.find('.retake-confirm').exists()).toBe(false)

    await stub.trigger('click')
    expect(stub.attributes('aria-expanded')).toBe('true')
    expect(hub.find('.retake-confirm').text()).toContain('Retaking replaces your INFP result.')

    await stub.trigger('click')
    expect(hub.find('.retake-confirm').exists()).toBe(false)
  })
})
