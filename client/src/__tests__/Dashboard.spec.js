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
    expect(getDashboard('monthly', history, now).plays).toBe(3)
    expect(week.minutes).toBeUndefined()
    expect(week.radar).toBeUndefined()
  })
  it('counts today and the previous 29 days for the monthly period', () => {
    const history = [
      { track: record('newest'), played_at: '2026-10-19T10:00:00' },
      { track: record('first-day'), played_at: '2026-09-20T00:00:00' },
      { track: record('too-old'), played_at: '2026-09-19T23:59:59' },
    ]
    const month = getDashboard('monthly', history, now)
    expect(month.date).toBe('20 September to 19 October')
    expect(month.plays).toBe(2)
    expect(month.daily).toHaveLength(30)
  })
  it('labels a 30-day chart with real dates across a month boundary', () => {
    const data = getDashboard('monthly', [], now)
    const chart = mount(ListeningChart, { props: { type: 'days', data } })
    const labels = chart.findAll('.day-label').map((node) => node.text())
    expect(labels[0]).toBe('20')
    expect(labels[4]).toBe('24')
    expect(labels[9]).toBe('29')
    expect(labels[14]).toBe('4')
    expect(labels[29]).toBe('19')
    expect(labels[1]).toBe('')
  })
  it('counts only today for the daily period', () => {
    const song = record('song')
    const history = [
      { track: song, played_at: '2026-10-19T00:00:00' },
      { track: song, played_at: '2026-10-19T10:00:00' },
      { track: song, played_at: '2026-10-18T23:59:59' },
      { track: record('later'), played_at: '2026-10-19T18:00:00' },
    ]
    const today = getDashboard('daily', history, now)
    expect(today.period).toBe('daily')
    expect(today.date).toBe('19 October')
    expect(today.plays).toBe(2)
    expect(today.songs).toHaveLength(1)
    expect(today.songs[0].daily).toBe(2)
    expect(today.artists[0].daily).toBe(2)
    expect(today.daily).toHaveLength(1)
  })
  it('does not invent data when there is no history', () => {
    const data = getDashboard('weekly', [], now)
    expect(data.plays).toBe(0)
    expect(data.artists).toEqual([])
    expect(data.peak).toBeNull()
    expect(data.daily.every((day) => day.value === 0)).toBe(true)
  })
  it('renders observed daily counts without inferring discoveries', () => {
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
    expect(daily.findAll('.play-equaliser li')).toHaveLength(7)
    expect(daily.findAll('.day-value').map((node) => node.text())).toEqual([
      '0',
      '0',
      '0',
      '0',
      '0',
      '1',
      '2',
    ])
    expect(daily.html()).not.toContain('NaN')
  })
  it('shows a connection prompt instead of sample rankings', () => {
    const wrapper = mount(Dashboard, {
      global: { plugins: [createPinia()], stubs: ['RouterLink', 'ListeningArtwork'] },
    })
    expect(wrapper.text()).toContain('Connect Spotify to see your music at a glance')
    expect(wrapper.find('.artist-list').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Sample data')
    wrapper.unmount()
  })
  it('encodes Spotify searches', () => {
    expect(spotifySearch('a / b')).toBe('https://open.spotify.com/search/a%20%2F%20b')
  })
  it('keeps monthly dates in a compact equaliser with accessible counts', async () => {
    const data = getDashboard(
      'monthly',
      [{ track: record('a'), played_at: '2026-10-19T10:00:00' }],
      now,
    )
    const chart = mount(ListeningChart, { props: { type: 'days', data } })
    const days = chart.findAll('.play-equaliser button')
    expect(days).toHaveLength(30)
    expect(chart.findAll('.day-value').map((node) => node.text())).toEqual(['1'])
    expect(days.at(-1).findAll('.day-blocks span')).toHaveLength(10)
    await days.at(-1).trigger('click')
    expect(chart.find('.calendar-readout').text()).toContain('1 recorded plays')
    expect(days.at(-1).attributes('aria-pressed')).toBe('true')
  })
  it('draws plays by hour as a 24-hour clock with the busiest hour marked', async () => {
    const data = getDashboard(
      'weekly',
      [
        { track: record('a'), played_at: '2026-10-18T13:05:00' },
        { track: record('b'), played_at: '2026-10-18T13:40:00' },
        { track: record('c'), played_at: '2026-10-18T23:10:00' },
      ],
      now,
    )
    const chart = mount(ListeningChart, { props: { type: 'hours', data } })
    const wedges = chart.findAll('.hour-wedge')
    expect(wedges).toHaveLength(24)
    expect(chart.find('.hour-clock').attributes('aria-label')).toContain('Busiest at 1 pm')
    expect(wedges.at(13).classes()).toContain('peak')
    expect(chart.find('.clock-hand').exists()).toBe(true)
    await wedges.at(23).trigger('click')
    expect(chart.find('.calendar-readout').text()).toBe('11 pm: 1 recorded plays')
    chart.unmount()
  })
})
