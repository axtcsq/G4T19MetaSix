import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PersonalityHub from '../views/personality/personality-hub.vue'
import { getPersonality, getPersonalityTypes, getQuizzes } from '@/api/quiz'

const { route } = vi.hoisted(() => ({ route: { hash: '' } }))
vi.mock('vue-router', () => ({ useRoute: () => route }))

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
        RouterLink: { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' },
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

describe('A Song for You', () => {
  it('links to the Listening Room with the song to play', async () => {
    vi.clearAllMocks()
    getQuizzes.mockResolvedValue(QUIZZES)
    getPersonalityTypes.mockResolvedValue(TYPES)
    getPersonality.mockResolvedValue({
      type: { id: 'poet', name: 'The Poet' },
      traits: [],
      insights: [],
      quizResults: [],
      song: { id: 'abc123', name: 'A song', artist: 'An artist', reason: 'A reason.' },
    })
    const hub = await mountHub()
    const link = hub.findAll('.song-actions a').find((item) => item.text().includes('Listening Room'))
    expect(link.text()).toBe('Play in Listening Room')
    expect(JSON.parse(link.attributes('data-to'))).toEqual({ name: 'listen', query: { play: 'abc123' } })
  })
})

describe('A quiz not taken yet', () => {
  it('has the same parts as a taken one', async () => {
    vi.clearAllMocks()
    getPersonalityTypes.mockResolvedValue(TYPES)
    getPersonality.mockResolvedValue(null)
    getQuizzes.mockResolvedValue([{ ...QUIZZES[0], questionCount: 12, latestResult: null }])
    const hub = await mountHub()
    expect(hub.find('.quiz-result').text()).toContain('Not taken yet')
    expect(hub.find('.quiz-result').text()).toContain('12 questions')
    expect(hub.find('.card-actions').text()).toBe('Get started')
  })
})

describe('Arriving at Patterns', () => {
  const scrollIntoView = vi.fn()
  beforeEach(() => {
    vi.clearAllMocks()
    getPersonalityTypes.mockResolvedValue(TYPES)
    getPersonality.mockResolvedValue(null)
    getQuizzes.mockResolvedValue(QUIZZES)
    vi.spyOn(document, 'getElementById').mockReturnValue({ scrollIntoView })
  })
  afterEach(() => {
    route.hash = ''
    vi.restoreAllMocks()
  })

  it('goes to Patterns once the quizzes above it have loaded', async () => {
    route.hash = '#patterns'
    await mountHub()
    expect(document.getElementById).toHaveBeenCalledWith('patterns')
    expect(scrollIntoView).toHaveBeenCalledOnce()
  })

  it('stays at the top without the link', async () => {
    await mountHub()
    expect(scrollIntoView).not.toHaveBeenCalled()
  })
})

describe('Your result on a quiz card', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getPersonalityTypes.mockResolvedValue(TYPES)
    getPersonality.mockResolvedValue(null)
    getQuizzes.mockResolvedValue([{ ...QUIZZES[0], latestResult: { title: 'INFP', subtitle: 'The Dreamer' } }])
  })

  it('shows the result, with a link to it', async () => {
    const hub = await mountHub()
    expect(hub.find('.quiz-result').text()).toContain('You got INFP')
    expect(hub.find('.quiz-result').text()).toContain('The Dreamer')
    expect(hub.find('.card-actions--retry').text()).toContain('View result')
    expect(hub.text()).not.toContain('Get started')
  })

  it('asks before retaking', async () => {
    const hub = await mountHub()
    const retake = hub.find('.retry-button')
    expect(retake.attributes('aria-label')).toBe('Retake Music MBTI')
    expect(hub.find('.retake-confirm').exists()).toBe(false)

    await retake.trigger('click')
    expect(hub.find('.retake-confirm').text()).toContain('Retaking replaces your INFP result.')
    await hub.find('.retake-confirm .peach-button--quiet').trigger('click')
    expect(hub.find('.retake-confirm').exists()).toBe(false)
  })
})
