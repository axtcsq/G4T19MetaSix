import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PastEntries from '../components/journal/PastEntries.vue'

const ENTRY = {
  _id: 'log1',
  mood: 'Happy',
  journal: 'A good day.',
  createdAt: '2026-11-04T09:00:00.000Z',
}

const mountEntries = (pinnedId = null) =>
  mount(PastEntries, {
    props: { entries: [ENTRY], pinnedId },
    global: { stubs: { MoodFace: true, JournalDrawingNote: true } },
  })

describe('Pin button in Past Entries', () => {
  it('is an icon with a label for screen readers, not words', () => {
    const pin = mountEntries().find('.pin-button')
    expect(pin.text()).toBe('')
    expect(pin.find('svg').exists()).toBe(true)
    expect(pin.attributes('aria-label')).toBe('Pin to profile')
    expect(pin.attributes('aria-pressed')).toBe('false')
    expect(pin.attributes('title')).toBe('Pin to profile')
  })

  it('pins the entry when pressed', async () => {
    const entries = mountEntries()
    await entries.find('.pin-button').trigger('click')
    expect(entries.emitted('pin')).toEqual([['log1']])
  })

  it('shows when pinned, and unpins when pressed again', async () => {
    const entries = mountEntries('log1')
    const pin = entries.find('.pin-button')
    expect(pin.attributes('aria-pressed')).toBe('true')
    expect(pin.attributes('title')).toBe('Pinned to profile')
    await pin.trigger('click')
    expect(entries.emitted('pin')).toEqual([[null]])
  })
})
