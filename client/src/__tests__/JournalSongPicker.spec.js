import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import JournalSongPicker from '@/components/journal/JournalSongPicker.vue'
import { searchSongs } from '@/api/songs'

vi.mock('@/api/songs', () => ({ searchSongs: vi.fn() }))
afterEach(() => vi.useRealTimers())

it('ignores old search results as soon as the query changes', async () => {
  vi.useFakeTimers()
  let finish
  searchSongs.mockReturnValue(new Promise((resolve) => { finish = resolve }))
  const wrapper = mount(JournalSongPicker)
  await wrapper.get('input').setValue('old title')
  await vi.advanceTimersByTimeAsync(300)
  await wrapper.get('input').setValue('new title')
  finish([{ id: 'old', name: 'Old result', artists: [] }])
  await flushPromises()
  expect(wrapper.text()).not.toContain('Old result')
  wrapper.unmount()
  await vi.advanceTimersByTimeAsync(300)
  expect(searchSongs).toHaveBeenCalledTimes(1)
})
