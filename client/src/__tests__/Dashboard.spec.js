import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import Dashboard from '../views/dashboard.vue'
import { getDashboard, spotifySearch } from '../data/spotifyDashboard'
import ListeningChart from '../components/dashboard/ListeningChart.vue'

const now = new Date('2026-10-19T12:00:00')
const record = (id, artist = 'Artist') => ({
  id,
  uri: `spotify:track:${id}`,
  name: id,
  artists: [{ id: artist, name: artist }],
  album: { name: 'Album', images: [] },
})
describe('Spotify listening portrait', () => {
  it('aggregates returned plays, filters periods and retains playable Spotify records', () => {
    const song = record('song')
    const history = [
      { track: song, played_at: '2026-10-19T10:00:00' },
      { track: song, played_at: '2026-10-18T10:00:00' },
      { track: record('older', 'Other artist'), played_at: '2026-10-02T10:00:00' },
      { track: record('future'), played_at: '2026-10-20T10:00:00' },
      { track: null, played_at: '2026-10-19T10:00:00' },
    ]
    const week = getDashboard('weekly', history, now)
    expect(week.date).toBe('13 October to 19 October')
    expect(week.plays).toBe(2)
    expect(week.tracks).toBe(1)
    expect(week.artistsCount).toBe(1)
    expect(week.songs[0].weekly).toBe(2)
    expect(week.songs[0].record).toBe(song)
    expect(week.hourly[10]).toBe(2)
    expect(week.daily).toHaveLength(7)
    expect(week.daily.reduce((sum, day) => sum + day.value, 0)).toBe(2)
    expect(week.repeatListening.map((item) => item.value)).toEqual([1, 1])
    expect(getDashboard('monthly', history, now).plays).toBe(3)
    expect(week.minutes).toBeUndefined()
    expect(week.radar).toBeUndefined()
  })
  it('does not invent data when there is no history', () => {
    const data = getDashboard('weekly', [], now)
    expect(data.plays).toBe(0)
    expect(data.artists).toEqual([])
    expect(data.peak).toBeNull()
    expect(data.daily.every((day) => day.value === 0)).toBe(true)
    expect(data.repeatListening.map((item) => item.value)).toEqual([0, 0])
  })
  it('renders observed daily and repeat counts without inferring discoveries', () => {
    const data = getDashboard(
      'weekly',
      [
        { track: record('a'), played_at: '2026-10-19T10:00:00' },
        { track: record('a'), played_at: '2026-10-19T11:00:00' },
        { track: record('b'), played_at: '2026-10-18T10:00:00' },
      ],
      now,
    )
    const daily = mount(ListeningChart, { props: { type: 'days', data } })
    expect(daily.findAll('.daily-plays li')).toHaveLength(7)
    expect(daily.findAll('.daily-plays strong').map((node) => node.text())).toEqual([
      '0',
      '0',
      '0',
      '0',
      '0',
      '1',
      '2',
    ])
    const repeats = mount(ListeningChart, { props: { type: 'repeats', data } })
    expect(repeats.text()).toContain('2 plays')
    expect(repeats.text()).toContain('1 play')
    expect(repeats.html()).not.toContain('NaN')
  })
  it('shows a connection prompt instead of sample rankings', () => {
    const wrapper = mount(Dashboard, {
      global: { plugins: [createPinia()], stubs: ['RouterLink', 'ListeningArtwork'] },
    })
    expect(wrapper.text()).toContain('Connect Spotify to see your listening portrait')
    expect(wrapper.find('.artist-list').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Sample data')
    wrapper.unmount()
  })
  it('encodes Spotify searches', () => {
    expect(spotifySearch('a / b')).toBe('https://open.spotify.com/search/a%20%2F%20b')
  })
})
