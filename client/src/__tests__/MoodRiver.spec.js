import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MoodRiver from '../components/dashboard/MoodRiver.vue'
import { getMoodInsights } from '@/api/listens'

vi.mock('@/api/listens', () => ({ getMoodInsights: vi.fn() }))
// The drawing itself needs a real canvas; these tests cover the data and controls around it.
vi.mock('p5', () => ({
  default: class {
    constructor() {}
    loop() {}
    noLoop() {}
    redraw() {}
    remove() {}
  },
}))

class Observer {
  observe() {}
  disconnect() {}
}

describe('Mood river', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.IntersectionObserver = Observer
    globalThis.ResizeObserver = Observer
    window.matchMedia = () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    })
  })

  it('gives every day a place and describes its mix', async () => {
    getMoodInsights.mockResolvedValue({
      days: [
        { date: '2026-10-19', axes: { happy: 2, relaxed: 1, sad: 6, angry: 1, anxious: 0 } },
        { date: '2026-10-21', axes: { happy: 5, relaxed: 0, sad: 0, angry: 0, anxious: 0 } },
      ],
    })
    const river = mount(MoodRiver, { props: { from: '2026-10-19', to: '2026-10-21' } })
    await flushPromises()

    expect(getMoodInsights).toHaveBeenCalledWith('2026-10-19', '2026-10-21')
    const days = river.findAll('.river-day')
    expect(days).toHaveLength(3)
    expect(days.at(0).attributes('aria-label')).toContain('· 10 plays: Sad 60%, Happy 20%, Relaxed 10%')
    expect(days.at(1).attributes('aria-label')).toContain('no analysed plays')

    await days.at(2).trigger('click')
    expect(river.find('.river-readout').text()).toContain('· 5 plays: Happy 100%')
    river.unmount()
  })

  it('explains an empty river', async () => {
    getMoodInsights.mockResolvedValue({ days: [] })
    const river = mount(MoodRiver, { props: { from: '2026-10-19', to: '2026-10-20' } })
    await flushPromises()

    expect(river.find('.river-status').text()).toContain('Your river fills up')
    expect(river.find('.river-day').exists()).toBe(false)
    river.unmount()
  })
})
