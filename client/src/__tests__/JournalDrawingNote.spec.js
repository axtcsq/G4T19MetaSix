import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import JournalDrawingNote from '@/components/journal/JournalDrawingNote.vue'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
it('shows the saved drawing on a labelled sticky note', async () => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  const wrapper = mount(JournalDrawingNote, {
    props: { label: 'Drawing from 1 Nov 2026', drawing: { width: 100, height: 100, items: [] } },
  })
  await flushPromises()
  const note = wrapper.find('.drawing-note')
  expect(note.attributes('aria-label')).toBe('Drawing from 1 Nov 2026')
  expect(note.find('.note-title').text()).toBe('A little sketch')
  expect(note.find('canvas').attributes('role')).toBe('img')
  wrapper.unmount()
})
