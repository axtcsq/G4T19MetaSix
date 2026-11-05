import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TrackWaveform from '../components/dashboard/TrackWaveform.vue'

const song = (id, plays) => ({ id, title: id, artist: 'Artist', art: '', weekly: plays })

describe('Top tracks waveform', () => {
  it('gives each song a stretch as wide as its plays, in its own colour', async () => {
    const wave = mount(TrackWaveform, {
      props: { songs: [song('a', 41), song('b', 9), song('c', 3)], period: 'weekly' },
    })
    const stretches = wave.findAll('.stretch')
    expect(stretches).toHaveLength(3)
    // 90 bars across the wave, with at least 5 for the quietest song.
    expect(stretches.map((stretch) => stretch.findAll('.bar').length)).toEqual([70, 15, 5])
    const colors = stretches.map(
      (stretch) => stretch.attributes('style').match(/--song: ([^;]+)/)[1],
    )
    expect(new Set(colors).size).toBe(3)
    // The list's play bars get the same colours.
    expect(wave.emitted('colors').at(-1)[0]).toEqual({ a: colors[0], b: colors[1], c: colors[2] })

    await stretches.at(1).trigger('pointerenter')
    expect(wave.find('.wave-readout').text()).toBe('b · Artist · 9 plays (17%)')
    expect(stretches.at(1).attributes('aria-pressed')).toBe('true')
    await stretches.at(1).trigger('pointerleave')
    expect(wave.find('.wave-readout').text()).toBe('Point at the wave to see each song.')
  })

  it('pauses with the dashboard and shows nothing without songs', async () => {
    const wave = mount(TrackWaveform, {
      props: { songs: [song('a', 2)], period: 'weekly', paused: true },
    })
    expect(wave.classes()).toContain('is-paused')
    await wave.setProps({ songs: [] })
    expect(wave.find('.track-wave').exists()).toBe(false)
  })
})
