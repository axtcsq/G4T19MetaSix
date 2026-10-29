import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SongPage from '../views/song.vue'
import { getTrack } from '@/api/tracks'

vi.mock('@/api/tracks', () => ({ getTrack: vi.fn() }))
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: '7w87IxuO7BDcJ3YUqCyMTT' } }),
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}))

const stubs = {
  SiteFooter: { template: '<footer />' },
  MoodTag: { props: ['trackId', 'hidePendingLyrics'], template: '<span class="mood-tag-stub" />' },
}

const FEATURES = [
  {
    key: 'valence',
    label: 'Valence (sound)',
    low: 'Sad',
    high: 'Happy',
    about: 'How positive.',
    value: 0.96,
    strength: 'high',
  },
  {
    key: 'energy',
    label: 'Energy',
    low: 'Calm',
    high: 'Intense',
    about: 'How intense.',
    value: 0.71,
    strength: 'fairly high',
  },
]

// Pumped Up Kicks: cheerful sound, dark words.
const kicks = {
  id: '7w87IxuO7BDcJ3YUqCyMTT',
  name: 'Pumped Up Kicks',
  artists: ['Foster the People'],
  album: { name: 'Torches', imageUrl: null },
  spotifyUrl: 'https://open.spotify.com/track/7w87IxuO7BDcJ3YUqCyMTT',
  plays: 3,
  lastPlayedAt: '2026-10-20T10:00:00.000Z',
  lyricsOff: false,
  tag: { lyricsNote: null },
  sound: { name: 'Euphoric', blurb: 'Bright and high-energy.', axis: 'happy' },
  withLyrics: { name: 'Deceptively upbeat', blurb: 'Bright music, dark words.', axis: 'anxious' },
  features: FEATURES,
  energy: 0.71,
  blend: {
    valence: 0.8,
    audio: 0.96,
    lyrics: 0.3,
    weight: 0.3,
    contrast: 'dark-words',
    contrastLabel: 'Upbeat sound, darker words',
  },
  lyrics: {
    status: 'found',
    translatedFrom: null,
    emotionalShare: 0.6,
    emotions: [['anger', 0.34]],
    darkThemes: ['gun', 'run'],
    highlights: { positive: [], negative: ['All the other kids / with the pumped up kicks'] },
  },
}

async function mountPage(song) {
  getTrack.mockResolvedValue(song)
  const wrapper = mount(SongPage, { global: { stubs } })
  await flushPromises()
  return wrapper
}

describe('Song page', () => {
  beforeEach(() => vi.clearAllMocks())

  it('explains both readings, the clash and the lyrics', async () => {
    const wrapper = await mountPage(kicks)

    expect(getTrack).toHaveBeenCalledWith('7w87IxuO7BDcJ3YUqCyMTT')
    expect(wrapper.find('h1').text()).toBe('Pumped Up Kicks')
    expect(wrapper.text()).toContain('You’ve played this 3 times')
    expect(wrapper.text()).toContain('Counts as Anxious in your mood history')
    const readings = wrapper.findAll('.reading')
    expect(readings[0].text()).toContain('Euphoric')
    expect(readings[1].text()).toContain('Deceptively upbeat')
    expect(wrapper.find('.agreement').text()).toContain('The readings differ')
    expect(wrapper.find('.contrast').text()).toBe('Upbeat sound, darker words')
    expect(wrapper.text()).toContain('Dark themes in the words: gun, run')
    expect(wrapper.find('blockquote').text()).toBe('All the other kids / with the pumped up kicks')
    // The song's dot sits at its combined positivity and its energy.
    expect(wrapper.find('.dot-song').attributes('style')).toContain('left: 80%')
    expect(wrapper.find('.dot-song').attributes('style')).toContain('bottom: 71%')
    expect(document.title).toBe('Pumped Up Kicks · MetaFor')
  })

  it('shows the sound reading only when lyrics analysis is off', async () => {
    const wrapper = await mountPage({
      ...kicks,
      lyricsOff: true,
      withLyrics: null,
      lyrics: undefined,
      blend: {
        valence: 0.96,
        audio: 0.96,
        lyrics: null,
        weight: 0,
        contrast: null,
        contrastLabel: null,
      },
    })

    expect(wrapper.findAll('.reading')[1].text()).toContain('Not available')
    expect(wrapper.text()).toContain('Lyrics analysis is off in your profile')
    expect(wrapper.text()).toContain('Counts as Happy')
    expect(wrapper.find('.dot-words').exists()).toBe(false)
  })

  it('says when the lyrics are still to come', async () => {
    const wrapper = await mountPage({
      ...kicks,
      tag: { lyricsNote: 'pending' },
      withLyrics: null,
      lyrics: undefined,
      blend: {
        valence: 0.96,
        audio: 0.96,
        lyrics: null,
        weight: 0,
        contrast: null,
        contrastLabel: null,
      },
    })

    expect(wrapper.text()).toContain('The lyrics haven’t been read yet')
  })

  it('says instrumental songs contain no lyrics', async () => {
    const wrapper = await mountPage({
      ...kicks,
      instrumental: true,
      lyricsStatus: 'instrumental',
      tag: { lyricsNote: null },
      withLyrics: null,
      lyrics: { status: 'instrumental' },
      blend: {
        valence: 0.96,
        audio: 0.96,
        lyrics: null,
        weight: 0,
        contrast: null,
        contrastLabel: null,
      },
    })

    expect(wrapper.findAll('.reading')[1].text()).toContain(
      'This song is instrumental and contains no lyrics.',
    )
    expect(wrapper.find('.mood-tag-stub').props('hidePendingLyrics')).toBe(true)
  })

  it('explains a song with no audio data', async () => {
    const wrapper = await mountPage({
      ...kicks,
      tag: { noMood: 'no-data' },
      sound: undefined,
      withLyrics: undefined,
      features: undefined,
      blend: undefined,
      lyrics: undefined,
    })

    expect(wrapper.text()).toContain('No mood for this song')
    expect(wrapper.text()).toContain('common for new releases')
    expect(wrapper.find('.readings').exists()).toBe(false)
  })

  it('explains a song we have never seen', async () => {
    getTrack.mockRejectedValue(Object.assign(new Error('Not found'), { status: 404 }))
    const wrapper = mount(SongPage, { global: { stubs } })
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toContain('We haven’t analysed this song yet')
  })
})
