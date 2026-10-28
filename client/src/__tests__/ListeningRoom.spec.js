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

  it('animates the decorative wave only during visible playback and cleans up', async () => {
    const remove = vi.spyOn(document, 'removeEventListener')
    const wrapper = mount(AmbientWave, { props: { playing: false } })
    expect(wrapper.attributes('aria-hidden')).toBe('true')
    expect(wrapper.findAll('i')).toHaveLength(64)
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
