import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import JournalDrawingNote from '@/components/journal/JournalDrawingNote.vue'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
it('moves the note with buttons and clamps movement to the notebook', async () => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  const wrapper = mount(JournalDrawingNote, {
    props: { label: 'Saved drawing', drawing: { width: 100, height: 100, items: [] } },
  })
  const stage = wrapper.find('.note-stage').element
  const note = wrapper.find('.drawing-note').element
  Object.defineProperties(stage, { clientWidth: { value: 500 }, clientHeight: { value: 500 } })
  Object.defineProperties(note, { offsetWidth: { value: 240 }, offsetHeight: { value: 250 } })
  await flushPromises()
  await wrapper.find('[aria-label="Move drawing right"]').trigger('click')
  expect(note.style.transform).toBe('translate(248px,230px)')
  await wrapper.find('.note-handle').trigger('keydown', { key: 'ArrowLeft' })
  expect(note.style.transform).toBe('translate(232px,230px)')
  for (let i = 0; i < 30; i++)
    await wrapper.find('[aria-label="Move drawing down"]').trigger('click')
  expect(note.style.transform).toBe('translate(232px,238px)')
  wrapper.unmount()
})
