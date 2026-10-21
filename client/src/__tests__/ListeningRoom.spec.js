import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ListeningRoom from '../views/listen.vue'
import { useListeningRoom } from '../composables/useListeningRoom'

describe('Spotify listening room', () => {
  beforeEach(() => setActivePinia(createPinia()))

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
