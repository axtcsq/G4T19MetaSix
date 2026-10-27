import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DailyMood from '../views/daily-mood.vue'
import { createMood, getMoods } from '@/api/moods'

vi.mock('@/api/moods', () => ({
  createMood: vi.fn(),
  getMoods: vi.fn(),
}))

const stubs = {
  SiteFooter: { template: '<footer />' },
  JournalCanvas: { template: '<div />' },
  JournalDrawingNote: {
    props: ['drawing', 'label'],
    template: '<aside class="drawing-note">Saved drawing</aside>',
  },
  UPopover: { template: '<div><slot /><slot name="content" /></div>' },
  UButton: {
    props: ['disabled', 'type', 'loading'],
    emits: ['click'],
    template:
      '<button :disabled="disabled" :type="type || \'button\'" @click="$emit(\'click\', $event)"><slot /></button>',
  },
  UBadge: { template: '<span><slot /></span>' },
  UTextarea: {
    props: ['id', 'modelValue'],
    emits: ['update:modelValue'],
    template:
      '<textarea :id="id" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
}

function mountView() {
  return mount(DailyMood, { global: { stubs } })
}

describe('Daily Mood API flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getMoods.mockResolvedValue([])
    createMood.mockResolvedValue({
      _id: 'entry-1',
      mood: 'Happy',
      journal: 'A good day',
      createdAt: '2026-10-13T10:00:00.000Z',
    })
  })

  it('loads entries from the API', async () => {
    getMoods.mockResolvedValue([
      {
        _id: 'entry-1',
        mood: 'Relaxed',
        journal: 'A quiet afternoon',
        createdAt: '2026-10-13T10:00:00.000Z',
      },
    ])

    const wrapper = mountView()
    await flushPromises()

    expect(getMoods).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('A quiet afternoon')
  })

  it('keeps the draft when switching between writing and history', async () => {
    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('#journal-entry').setValue('Keep my words')
    const toggle = wrapper.find('.history-toggle')
    await toggle.trigger('click')
    expect(wrapper.find('#past-entries').isVisible()).toBe(true)
    expect(wrapper.find('.journal-column').attributes('style')).toContain('display: none')
    await toggle.trigger('click')
    expect(wrapper.find('#journal-entry').element.value).toBe('Keep my words')
    expect(wrapper.find('.journal-column').isVisible()).toBe(true)
    expect(wrapper.find('.helper-launcher').exists()).toBe(true)
  })

  it('shows saved drawings on their own entry without touching the current draft', async () => {
    getMoods.mockResolvedValue([
      {
        _id: 'drawn',
        mood: 'Happy',
        journal: 'An older day',
        createdAt: '2026-10-27T09:00:00Z',
        drawing: { width: 100, height: 100, items: [{ type: 'line' }] },
      },
    ])
    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('#journal-entry').setValue('Today is different')
    await wrapper.find('.history-toggle').trigger('click')
    expect(wrapper.find('.entry-sheet.has-drawing').exists()).toBe(true)
    expect(wrapper.find('.drawing-note').text()).toBe('Saved drawing')
    expect(wrapper.find('.history-toggle').text()).toBe('Back to writing')
    expect(wrapper.find('#journal-entry').element.value).toBe('Today is different')
    expect(wrapper.text()).not.toContain('View drawing')
  })

  it('saves a mood to the API and adds the returned entry', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Happy')
      .trigger('click')
    await wrapper.find('textarea').setValue('  A good day  ')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(createMood).toHaveBeenCalledWith({ mood: 'Happy', journal: 'A good day', drawing: null })
    expect(wrapper.text()).toContain('A good day')
    expect(wrapper.text()).toContain('Entry saved.')
  })

  it('preserves the draft and offers retry when requests fail', async () => {
    getMoods.mockRejectedValueOnce(new Error('Server unavailable'))

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Server unavailable')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Try again')
      .trigger('click')
    await flushPromises()
    expect(getMoods).toHaveBeenCalledTimes(2)

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Happy')
      .trigger('click')
    await wrapper.find('textarea').setValue('Keep this reflection')
    createMood.mockRejectedValueOnce(new Error('Database unavailable'))
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('textarea').element.value).toBe('Keep this reflection')
    expect(wrapper.text()).toContain('Database unavailable')
  })
})
