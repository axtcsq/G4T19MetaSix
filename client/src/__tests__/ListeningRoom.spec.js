import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ListeningRoom from '../views/listen.vue'
import { useListeningRoom } from '../composables/useListeningRoom'
import AmbientWave from '../components/listening/AmbientWave.vue'

describe('Spotify listening room', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback) {
          this.callback = callback
        }
        observe() {
          this.callback([{ isIntersecting: true }])
        }
        disconnect() {}
      },
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('tracks visible playback without audio capture and cleans up', async () => {
    const remove = vi.spyOn(document, 'removeEventListener')
    const wrapper = mount(AmbientWave, { props: { playing: false } })
    expect(wrapper.get('svg').attributes('aria-hidden')).toBe('true')
    expect(wrapper.findAll('.wave-line')).toHaveLength(1)
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.find('image').exists()).toBe(false)
    await wrapper.setProps({ cover: '/album-one.jpg' })
    expect(wrapper.get('image').attributes('href')).toBe('/album-one.jpg')
    await wrapper.setProps({ cover: '/album-two.jpg' })
    expect(wrapper.get('image').attributes('href')).toBe('/album-two.jpg')
    expect(wrapper.classes()).not.toContain('is-playing')
    await wrapper.setProps({ playing: true })
    expect(wrapper.classes()).toContain('is-playing')
    await wrapper.setProps({ playing: false })
    expect(wrapper.classes()).not.toContain('is-playing')
    wrapper.unmount()
    expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
    remove.mockRestore()
  })

  it('requires connection and never displays or plays fixture records', async () => {
    const room = useListeningRoom()
    room.disconnect()
    const wrapper = mount(ListeningRoom, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
          VinylTurntable: { props: ['spinning'], template: '<div />' },
        },
      },
    })
    expect(wrapper.text()).toContain('Connect Spotify to load your music')
    expect(wrapper.findAll('.shelf-record')).toHaveLength(0)
    expect(wrapper.get('.track-copy h2').text()).toBe('Choose a song')
    expect(wrapper.get('[aria-label="Play"]').element.disabled).toBe(true)
    expect(wrapper.get('#playback-position').element.disabled).toBe(true)
    await room.toggle()
    await room.skip(1)
    expect(room.spinning.value).toBe(false)
    expect(room.track.value.id).toBe('')
    wrapper.unmount()
  })
  it('paces the seek wave from track tempo and falls back when tempo is unavailable', async () => {
    const wrapper = mount(AmbientWave, { props: { tempo: 60 } })
    expect(wrapper.element.style.getPropertyValue('--wave-duration')).toBe('2s')
    await wrapper.setProps({ tempo: 180 })
    expect(
      Number.parseFloat(wrapper.element.style.getPropertyValue('--wave-duration')),
    ).toBeCloseTo(2 / 3)
    for (const tempo of [null, 0, -20, NaN, Infinity]) {
      await wrapper.setProps({ tempo })
      expect(wrapper.element.style.getPropertyValue('--wave-duration')).toBe('3s')
    }
    wrapper.unmount()
  })
  it('clips the wave at the seek position and bounds invalid progress', async () => {
    const wrapper = mount(AmbientWave, { props: { progress: 40 } })
    expect(wrapper.element.style.getPropertyValue('--played')).toBe('40%')
    for (const [progress, expected] of [
      [-10, '0%'],
      [120, '100%'],
      [NaN, '0%'],
    ]) {
      await wrapper.setProps({ progress })
      expect(wrapper.element.style.getPropertyValue('--played')).toBe(expected)
    }
    wrapper.unmount()
  })
  it('pauses the seek wave offscreen and while the browser tab is hidden', async () => {
    let intersect
    const disconnect = vi.fn()
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback) {
          intersect = callback
        }
        observe() {
          intersect([{ isIntersecting: true }])
        }
        disconnect = disconnect
      },
    )
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    const wrapper = mount(AmbientWave, { props: { playing: true } })
    await wrapper.vm.$nextTick()
    expect(wrapper.classes()).toContain('is-playing')
    intersect([{ isIntersecting: false }])
    await wrapper.vm.$nextTick()
    expect(wrapper.classes()).not.toContain('is-playing')
    intersect([{ isIntersecting: true }])
    hidden.mockReturnValue(true)
    document.dispatchEvent(new Event('visibilitychange'))
    await wrapper.vm.$nextTick()
    expect(wrapper.classes()).not.toContain('is-playing')
    hidden.mockReturnValue(false)
    document.dispatchEvent(new Event('visibilitychange'))
    await wrapper.vm.$nextTick()
    expect(wrapper.classes()).toContain('is-playing')
    wrapper.unmount()
    expect(disconnect).toHaveBeenCalledOnce()
    hidden.mockRestore()
  })
  it('clears personal history, search and artwork on disconnect', () => {
    const room = useListeningRoom()
    room.records.value = [{ id: 'personal' }]
    room.history.value = [{ track: { id: 'personal' } }]
    room.query.value = 'personal query'
    room.disconnect()
    expect(room.records.value).toEqual([])
    expect(room.history.value).toEqual([])
    expect(room.query.value).toBe('')
    expect(room.track.value.album.images).toEqual([])
  })
})
